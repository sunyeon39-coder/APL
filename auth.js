// auth.js
// Google 로그인 전용 + users/{uid} 자동 관리 (FINAL)

import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   GOOGLE PROVIDER
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

/* ===============================
   STATE
=============================== */
let redirecting = false;

/* ===============================
   LOGIN BUTTON
=============================== */
const googleBtn = document.getElementById("googleLoginBtn");

googleBtn?.addEventListener("click", async () => {
  try {
    googleBtn.disabled = true;
    await signInWithPopup(auth, provider);
    // ❗ redirect는 onAuthStateChanged에서 처리
  } catch (err) {
    console.error("🔥 Google 로그인 실패", err);
    alert("Google 로그인에 실패했습니다.");
    googleBtn.disabled = false;
  }
});

/* ===============================
   AUTH STATE
=============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user || redirecting) return;

  redirecting = true;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // 🔥 최초 로그인 → 문서 생성
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName || "",
        nickname: user.displayName || "",
        photoURL: user.photoURL || "",
        role: "user",              // ⚠️ 기본값만
        provider: "google",
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      // 🔁 재로그인 → lastLogin만 갱신
      await setDoc(
        userRef,
        {
          lastLoginAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    // ✅ 로그인 완료 → hub로 이동
    location.replace("/index.html");

  } catch (err) {
    console.error("🔥 사용자 문서 처리 실패", err);
    alert("로그인 처리 중 오류가 발생했습니다.");
    redirecting = false;
    googleBtn && (googleBtn.disabled = false);
  }
});
