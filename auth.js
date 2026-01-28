// auth.js (LOGIN PAGE – FINAL + ROLE INIT)
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
   Google 로그인 버튼
   =============================== */
document
  .getElementById("googleLoginBtn")
  .addEventListener("click", async () => {
    console.log("➡️ Google Login Start");
    await signInWithPopup(auth, provider);
  });

/* ===============================
   로그인 상태 감시 + 사용자 생성
   =============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("ℹ 로그인 대기 중");
    return;
  }

  console.log("✅ 로그인 성공:", user.email);

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  // 🔥 최초 로그인 시에만 생성
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name: user.displayName || "",
      role: "user", // 기본 권한
      createdAt: serverTimestamp()
    });
    console.log("👤 신규 사용자 문서 생성");
  }

  // 🔁 단 한 번만 이동
  location.replace("/index.html");
});
