import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =================================================
   DOM
   ================================================= */
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleLoginBtn");
const errorMsg = document.getElementById("errorMsg");

/* =================================================
   GOOGLE PROVIDER
   ================================================= */
const googleProvider = new GoogleAuthProvider();

/* =================================================
   AUTO REDIRECT (이미 로그인 상태)
   ================================================= */
onAuthStateChanged(auth, user => {
  if (user) {
    location.replace("index.html");
  }
});

/* =================================================
   EMAIL / PASSWORD LOGIN
   ================================================= */
loginBtn.addEventListener("click", loginWithEmail);
passwordInput.addEventListener("keydown", e => {
  if (e.key === "Enter") loginWithEmail();
});

async function loginWithEmail() {
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

/* =================================================
   GOOGLE LOGIN
   ================================================= */
googleBtn.addEventListener("click", loginWithGoogle);

async function loginWithGoogle() {
  errorMsg.textContent = "";

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    // 🔥 최초 Google 로그인 시 user 문서 생성
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: "user",          // 기본 권한
        provider: "google",
        createdAt: serverTimestamp()
      });
    }

    location.replace("index.html");

  } catch (err) {
    console.error(err);

    if (err.code === "auth/popup-closed-by-user") {
      return; // 사용자가 닫은 경우 무시
    }

    errorMsg.textContent = "Google 로그인에 실패했습니다.";
  }
}

/* =================================================
   ERROR MESSAGE
   ================================================= */
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
