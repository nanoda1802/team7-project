const BASE_URL = 'http://localhost:9999/api';

    // 상태 관리 변수
    let isTeamSelectionMode = false; //팀모드
    let isRepresentativeSelectionMode = false;//대표지정
    let selectedTeam = [];
    let selectedRepresentative = null;

    // 버튼 요소 가져오기
    const teamSelectBtn = document.getElementById("teamSelectBtn");
    const representativeSelectBtn = document.getElementById("representativeSelectBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const confirmBtn = document.getElementById("confirmBtn");

    // 팀 지정 모드 활성화
    teamSelectBtn.addEventListener("click", () => {
      if (!isTeamSelectionMode) {
        resetSelections();
        isTeamSelectionMode = true;
        alert("팀 지정 모드가 활성화되었습니다.");
      }
    });

    // 대표 지정 모드 활성화
    representativeSelectBtn.addEventListener("click", () => {
      if (!isRepresentativeSelectionMode) {
        resetSelections();
        isRepresentativeSelectionMode = true;
        alert("대표 캐릭터 지정 모드가 활성화되었습니다.");
      }
    });

    // 취소 버튼 이벤트
    cancelBtn.addEventListener("click", () => {
      resetSelections();
      alert("모드가 초기화되었습니다.");
    });

    // 확인 버튼 이벤트
    confirmBtn.addEventListener("click", async () => {
      if (isTeamSelectionMode) {
        await submitTeamFormation();
      } else if (isRepresentativeSelectionMode) {
        await submitRepresentativeSelection();
      } else {
        alert("활성화된 모드가 없습니다.");
      }
    });

    // 초기화 함수
    function resetSelections() {
  isTeamSelectionMode = false;
  isRepresentativeSelectionMode = false;
  selectedTeam = [];
  selectedRepresentative = null;

  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    card.classList.remove('selected-team', 'selected-representative');
  });

  updateConfirmButtonState(); // 확인 버튼 상태 초기화
}

    // 팀 지정 API 호출
    async function submitTeamFormation() {
      if (selectedTeam.length !== 3) {
        alert("팀을 구성하려면 정확히 3명의 캐릭터를 선택해야 합니다.");
        return;
      }

      const formation = selectedTeam.map(agent => agent.agentKey);

      try {
        const response = await fetch(`${BASE_URL}/users/formation`, {
          method: 'PUT',
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("authToken")}` // 토큰 추가
          },
          body: JSON.stringify({ formation }),
        });

        if (!response.ok) throw new Error('팀 지정에 실패했습니다.');

        const data = await response.json();
        alert(data.message || "팀이 성공적으로 지정되었습니다!");
        resetSelections();
      } catch (error) {
        console.error(error);
        alert("오류가 발생했습니다.");
      }
    }

    // 대표 지정 API 호출
    async function submitRepresentativeSelection() {
      if (!selectedRepresentative) {
        alert("대표 캐릭터를 선택해야 합니다.");
        return;
      }
      try {
        const response = await fetch(`${BASE_URL}/users/favorite`, {
          method: 'PATCH',
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("authToken")}` // 토큰 추가
          },
          body: JSON.stringify({ agent: selectedRepresentative.agentKey }),
        });

        if (!response.ok) throw new Error('대표 캐릭터 지정에 실패했습니다.');

        const data = await response.json();
        alert(data.message || "대표 캐릭터가 성공적으로 지정되었습니다!");
        resetSelections();
      } catch (error) {
        console.error(error);
        alert("오류가 발생했습니다.");
      }
    }

    // 카드 클릭 이벤트
    function handleCardClick(card, agent) {
  if (isTeamSelectionMode) {
    if (selectedTeam.includes(agent)) {
      selectedTeam = selectedTeam.filter(item => item !== agent);
      card.classList.remove('selected-team');
    } else if (selectedTeam.length < 3) {
      selectedTeam.push(agent);
      card.classList.add('selected-team');
    } else {
      alert("팀은 최대 3개까지만 지정할 수 있습니다.");
    }
  } else if (isRepresentativeSelectionMode) {
    if (selectedRepresentative === agent) {
      selectedRepresentative = null;
      card.classList.remove('selected-representative');
    } else {
      const cards = document.querySelectorAll(".card");
      cards.forEach(c => c.classList.remove('selected-representative'));

      selectedRepresentative = agent;
      card.classList.add('selected-representative');
    }
  }

  updateConfirmButtonState(); // 확인 버튼 상태 업데이트
}

    // 카드 데이터 로드
    async function loadAgents() {
      try {
        const response = await fetch(`${BASE_URL}/users/agents`, {
          method: 'GET',
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("authToken")}` // 토큰 추가
          },
        });

        if (!response.ok) throw new Error('데이터를 가져오는 데 실패했습니다.');

        const data = await response.json();
        const cardContainer = document.getElementById('card-container');

        data.data.forEach(agent => {
          const card = document.createElement('div');
          card.classList.add('card');
          card.innerHTML = `
            <div class="card-header">${agent.name}</div>
            <div class="card-body">
               <span class="grade">${agent.agent.grade}</span>
            </div>
            <div class="card-footer">
              <div class="stars">${'★'.repeat(agent.class)}</div>
              <div class="team">${agent.agent.team}</div>
              <div class="position">포지션: ${agent.agent.position}</div>
            </div>
          `;

          card.addEventListener("click", () => handleCardClick(card, agent));
          cardContainer.appendChild(card);
        });
      } catch (error) {
        console.error(error);
        alert("오류가 발생했습니다.");
      }
    }

    //확인버튼 활성화 비활성화
    function updateConfirmButtonState() {
  if (
    (isTeamSelectionMode && selectedTeam.length === 3) ||
    (isRepresentativeSelectionMode && selectedRepresentative !== null)
  ) {
    confirmBtn.classList.remove("disabled"); // 버튼 활성화
  } else {
    confirmBtn.classList.add("disabled"); // 버튼 비활성화
  }
}
    



// 초기 실행
    loadAgents();