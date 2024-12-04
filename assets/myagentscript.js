async function loadAgents() {
    const BASE_URL = 'http://localhost:9999/api';
    const userKey = 3;

    try {
      // GET 요청에서 body는 필요하지 않음
      const response = await fetch(`${BASE_URL}/users/${userKey}/agents`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // 응답이 성공적인 경우 데이터 처리
      if (!response.ok) {
        throw new Error('데이터를 가져오는 데 실패했습니다.');
      }

      const data = await response.json();

      // 받은 데이터로 카드 생성
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
        cardContainer.appendChild(card);
      });
    } catch (error) {
      alert('오류가 발생했습니다.');
      console.error(error);
    }
  }

  loadAgents();