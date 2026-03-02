// js/login.js
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

console.log("🔥 login.js loaded");

/* ===============================
   로그인 상태면 즉시 hub로
=============================== */
onAuthStateChanged(auth, user => {
  console.log("👀 auth state:", user);

  if (user) {
    console.log("➡️ go hub");
    location.replace("hub.html");
  }
});

/* ===============================
   로그인 버튼
=============================== */
const loginBtn = document.getElementById("loginBtn");
const provider = new GoogleAuthProvider();

loginBtn.addEventListener("click", async () => {
  console.log("🔑 login click");

  try {
    await signInWithPopup(auth, provider);
    // 👉 여기서는 이동 안 해도 됨
    // onAuthStateChanged가 반드시 호출됨
  } catch (err) {
    console.error("❌ login error", err);
    alert("로그인 실패");
  }
});
