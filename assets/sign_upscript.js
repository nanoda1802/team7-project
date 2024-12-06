const BASE_URL = 'http://localhost:9999/api'; // 백엔드 API 주소

// 회원가입 처리
document.getElementById('signUpForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('signUpLoginId').value;
  const pw = document.getElementById('signUpPassword').value;
  const pwCheck = document.getElementById('signUpVerifyPassword').value;
  const nickname = document.getElementById('signUpName').value;

  try {
    const response = await fetch(`${BASE_URL}/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pw, pwCheck, nickname }),
    });

    const result = await response.json();
    if (response.ok) {
      alert(result.message);
    } else {
      alert(result.message || '회원가입에 실패했습니다.');
    }
  } catch (error) {
    alert('오류가 발생했습니다.');
    console.error(error);
  }
});