// auth.js (LOGIN PAGE – FINAL CLEAN VERSION)
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ===============================
   Google 로그인 버튼
   =============================== */
document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  console.log("➡️ Google Popup Login Start");
  await signInWithPopup(auth, provider);
});

/* ===============================
   로그인 상태 감시
   =============================== */
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ 로그인 성공 감지:", user.email);
    location.replace("/index.html");
  } else {
    console.log("ℹ 로그인 대기 중");
  }
});
