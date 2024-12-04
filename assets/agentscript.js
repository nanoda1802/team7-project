const showHow = document.getElementById('showHow');
const showWhat = document.getElementById('showWhat');
const confirmBtn = document.getElementById('confirmBtn');
const orderBy = document.getElementById('orderBy');
const orderHow = document.getElementById('orderHow');
const resultDiv = document.getElementById('result');

// 첫 번째 선택창 변경 시 두 번째 선택창 옵션 업데이트
function updateSelect2Options() {
    const value = showHow.value; // showHow 값을 가져옴
    let options = [];

    // showHow 값에 따라 동적으로 옵션 설정
    if (value === 'team') {
        options = ['데마시아', '녹서스', '아이오니아', '공허', '타곤', '자운', '슈리마', '프렐요드'];
    } else if (value === 'position') {
        options = ['wizard', 'warrior', 'tanker'];
    } else if (value === 'grade') {
        options = ['s', 'a'];
    }

    // showWhat의 기존 옵션 초기화 후 새 옵션 추가
    showWhat.innerHTML = '';
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        showWhat.appendChild(opt);
    });
}

// showHow 변경 시 옵션 업데이트 이벤트 등록
showHow.addEventListener('change', updateSelect2Options);

// 페이지 로드 시 초기 옵션 설정
updateSelect2Options();

// 확인 버튼 클릭 시 동작
confirmBtn.addEventListener('click', async () => {
   const BASE_URL = 'http://localhost:3012/api';
    const option = `${showHow.value},${showWhat.value},${orderBy.value},${orderHow.value}`;

    try {
        // API 호출
        const response = await fetch(`${BASE_URL}/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ option }),
        });

        if (!response.ok) {
throw new Error('데이터를 가져오는 데 실패했습니다.');
}

        const data = await response.json();


        const cardContainer = document.getElementById('card-container');

        cardContainer.innerHTML = '';

data.data.forEach(agent => {
const card = document.createElement('div');
card.classList.add('card');
card.innerHTML = `
  <div class="card-header">${agent.name}</div>
  <div class="card-body">
    <span>${agent.grade}</span>
  </div>
  <div class="card-footer">
    <div class="position">포지션: ${agent.position}</div>
  </div>
`;
cardContainer.appendChild(card);
});
    } catch (err) {
        console.error(err);
        resultDiv.innerHTML = `<p style="color:red;">서버 오류 발생</p>`;
    }
});