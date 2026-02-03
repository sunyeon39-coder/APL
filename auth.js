// auth.js — FINAL STABLE
// - Redirect ONLY (mobile safe)
// - Single authority for auth flow
// - Prevents early redirect loops

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
   DOM
=============================== */
const loginBtn = document.getElementById("googleLoginBtn");

/* ===============================
   PROVIDER
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ===============================
   STATE GUARD
=============================== */
let handled = false; // redirect / auth 중복 처리 방지

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
   REDIRECT RESULT (FIRST)
   - 반드시 onAuthStateChanged보다 먼저
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
=============================== */
onAuthStateChanged(auth, (user) => {
  console.log("👤 onAuthStateChanged:", user?.email || "null");

  // redirect 결과를 이미 처리했으면 무시
  if (handled) return;

  // 로그인 페이지(login.html)에서:
  // - user가 있으면 메인으로
  // - 없으면 아무 것도 하지 않음 (로그인 UI 유지)
  if (user) {
    handled = true;
    goAfterLogin();
  }
});

/* ===============================
   NAV
=============================== */
function goAfterLogin() {
  console.log("✅ login success → index.html");
  // replace로 뒤로가기 시 로그인 페이지로 안 돌아가게
  location.replace("index.html");
}
