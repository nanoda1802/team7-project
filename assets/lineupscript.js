const BASE_URL = 'http://localhost:9999/api';
const userKey = 3;


// 상태 관리 변수
let isTeamSelectionMode = false;
let isRepresentativeSelectionMode = false;
let selectedTeam = [];
let selectedRepresentative = null;

document.getElementById("teamSelectBtn").addEventListener("click", () => {
  isTeamSelectionMode = true;
  isRepresentativeSelectionMode = false;
  alert("팀 지정 모드가 활성화되었습니다.");
});

document.getElementById("representativeSelectBtn").addEventListener("click", () => {
  isTeamSelectionMode = false;
  isRepresentativeSelectionMode = true;
  alert("대표 캐릭터 지정 모드가 활성화되었습니다.");
});

// 카드 불러오기 및 이벤트 바인딩
async function loadAgents() {
  try {
    const response = await fetch(`${BASE_URL}/users/${userKey}/agents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
          <span>${agent.agent.grade}</span>
        </div>
        <div class="card-footer">
          <div class="stars">${'★'.repeat(agent.class)}</div>
          <div class="position">포지션: ${agent.agent.position}</div>
        </div>
      `;

      // 카드 클릭 이벤트 추가
      card.addEventListener("click", () => handleCardClick(card, agent));
      cardContainer.appendChild(card);
    });
  } catch (error) {
    alert('오류가 발생했습니다.');
    console.error(error);
  }
}

// 카드 선택 처리
function handleCardClick(card, agent) {
  if (isTeamSelectionMode) {
    if (selectedTeam.includes(agent)) {
      // 이미 선택된 팀에서 제거
      selectedTeam = selectedTeam.filter(item => item !== agent);
      card.classList.remove('selected-team');
    } else if (selectedTeam.length < 3) {
      // 최대 3개까지만 선택 가능
      selectedTeam.push(agent);
      card.classList.add('selected-team');
    } else {
      alert("팀은 최대 3개까지만 지정할 수 있습니다.");
    }
  } else if (isRepresentativeSelectionMode) {
    if (selectedRepresentative === agent) {
      // 대표 지정 취소
      selectedRepresentative = null;
      card.classList.remove('selected-representative');
    } else {
      // 기존 대표가 있으면 제거
      if (selectedRepresentative) {
        const cards = document.querySelectorAll(".card");
        cards.forEach(c => c.classList.remove('selected-representative'));
      }

      // 새로운 대표 지정
      selectedRepresentative = agent;
      card.classList.add('selected-representative');
    }
  }
}

loadAgents();