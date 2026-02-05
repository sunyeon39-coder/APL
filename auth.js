// auth.js — FINAL STABLE v2
// - Redirect ONLY (mobile / Safari safe)
// - Login page ONLY
// - No side effects on hub / index

import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   LOG
=============================== */
console.log("🔥 auth.js loaded");

/* ===============================
   DOM (login page only)
=============================== */
const loginBtn = document.getElementById("googleLoginBtn");

/* ===============================
   PROVIDER
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

/* ===============================
   STATE
=============================== */
let handled = false; // 중복 처리 방지

/* ===============================
   LOGIN CLICK
=============================== */
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    loginBtn.disabled = true;
    console.log("👉 signInWithRedirect");
    signInWithRedirect(auth, provider);
  });
}

/* ===============================
   REDIRECT RESULT (PRIORITY)
=============================== */
getRedirectResult(auth)
  .then((result) => {
    console.log("🔁 getRedirectResult:", result);

    if (result?.user && !handled) {
      handled = true;
      goAfterLogin();
    }
  })
  .catch((err) => {
    console.error("❌ getRedirectResult error:", err);
    if (loginBtn) loginBtn.disabled = false;
  });

/* ===============================
   AUTH STATE (FALLBACK)
   - 이미 로그인된 상태로 login.html에 들어온 경우
=============================== */
onAuthStateChanged(auth, (user) => {
  console.log("👤 onAuthStateChanged:", user?.email || "null");

  if (handled) return;

  // 🔥 login.html에서만 동작
  if (user) {
    handled = true;
    goAfterLogin();
  }
});

/* ===============================
   NAV
=============================== */
function goAfterLogin() {
  console.log("✅ login success → hub.html");

  // login.html 기록 제거 (뒤로가기 방지)
  location.replace("hub.html");
}
