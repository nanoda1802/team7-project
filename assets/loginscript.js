const BASE_URL = "http://localhost:9999/api"; // 백엔드 API 주소
let token = null; // 로그인 후 저장된 토큰

// 로그인 처리
document.getElementById("signInForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("signInLoginId").value;
  const pw = document.getElementById("signInPassword").value;

  try {
    const response = await fetch(`${BASE_URL}/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pw }),
      credentials: "include",
    });

    const result = await response.json();

    console.log("Response from server:", result);
    console.log("User Key:", result.key);

    if (response.ok) {
      const token = response.headers.get("authorization").split(" ")[1]; // 토큰 저장
      localStorage.setItem("authToken", token); //토큰만 저장하고 헤더에 넣을때 하는거임.
      

      alert(result.message);
      window.location.href = "mainpage.html";
    } else {
      alert(result.message || "로그인에 실패했습니다.");
    }
  } catch (error) {
    alert("오류가 발생했습니다.");
    console.error(error);
  }
});
