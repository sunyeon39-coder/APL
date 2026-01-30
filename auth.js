// auth.js (Google 로그인 전용)

import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const db = getFirestore();

/* ===============================
   Google Provider
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ===============================
   Google Login Button
=============================== */
const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    console.log("➡️ Google 로그인 시작");
    await signInWithPopup(auth, provider);
  });
}

/* ===============================
   Auth State
=============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("ℹ 로그인 대기 중");
    return;
  }

  console.log("✅ 로그인 성공:", user.email);

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  // 🔥 최초 로그인 시에만 문서 생성
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name: user.displayName || "",
      role: "user",
      createdAt: serverTimestamp()
    });
    console.log("👤 새 사용자 문서 생성");
  }

  // 이동
  location.replace("/index.html");
});
