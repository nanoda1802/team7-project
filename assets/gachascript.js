const BASE_URL = 'http://localhost:9999/api';
const userKey = 1;
const pickup = "3";

const cardContainer = document.getElementById('card-container');
const singleDrawBtn = document.getElementById('single-draw-btn');
const multiDrawBtn = document.getElementById('multi-draw-btn');

// API 요청 함수
async function fetchGachaResults(count,pickup) {
  try {
    const response = await fetch(`${BASE_URL}/users/${userKey}/agents/gacha`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({count,pickup}),
    });

    if (!response.ok) {
      throw new Error("가챠 요청 실패!");
    }

    const { results } = await response.json();
    displayCards(results);
  } catch (error) {
    console.error(error);
    alert("가챠 결과를 불러오는 데 실패했습니다.");
  }
}

// 카드 DOM 생성 및 표시
function displayCards(results) {
  cardContainer.innerHTML = ""; // 기존 카드 초기화
  results.forEach((result) => {
    const card = document.createElement("div");
    card.classList.add("card");

    // 강화재료 처리
    if (result.agent === "enhancer") {
      card.innerHTML = `
        <div class="card-header">강화 재료</div>
        <div class="card-body">
          <span>등급: 재료</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="card-header">${result.agent.name}</div>
        <div class="card-body">
          <span>등급: ${result.agent.grade}</span>
        </div>
        <div class="card-footer">
          <div class="position">포지션: ${result.agent.position}</div>
        </div>
      `;
    }

    cardContainer.appendChild(card);
  });
}

// 버튼 클릭 이벤트
singleDrawBtn.addEventListener("click", () => fetchGachaResults("1", pickup)); // 1뽑
multiDrawBtn.addEventListener("click", () => fetchGachaResults("10", pickup)); // 10뽑