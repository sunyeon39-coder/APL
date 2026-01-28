import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");

/* 이미 로그인 상태면 바로 메인으로 */
onAuthStateChanged(auth, user => {
  if (user) {
    location.replace("index.html");
  }
});

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "이메일과 비밀번호를 입력하세요.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "로그인 중…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.replace("index.html");
  } catch (err) {
    console.error(err);
    errorMsg.textContent = getErrorMessage(err.code);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "로그인";
  }
}

function getErrorMessage(code) {
  switch (code) {
    case "auth/user-not-found":
      return "존재하지 않는 계정입니다.";
    case "auth/wrong-password":
      return "비밀번호가 올바르지 않습니다.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "잠시 후 다시 시도하세요.";
    default:
      return "로그인에 실패했습니다.";
  }
}
