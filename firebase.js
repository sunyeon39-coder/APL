// auth.js — FINAL (Single Redirect Authority)

import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONFIG
=============================== */

const REDIRECT_URL = "hub.html";

/* ===============================
   UTIL
=============================== */

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/* ===============================
   GOOGLE PROVIDER
=============================== */

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ===============================
   STATE
=============================== */

let redirecting = false;

/* ===============================
   FIRESTORE USER DOC
=============================== */

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    email: user.email,
    nickname: user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL || "",
    role: "user",
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  });
}

/* ===============================
   LOGIN BUTTON
=============================== */

const googleLoginBtn = document.getElementById("googleLoginBtn");

googleLoginBtn?.addEventListener("click", async () => {
  googleLoginBtn.disabled = true;

  // 🔥 persistence는 await 없이 (iOS Safari SAFE)
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  try {
    if (isMobile()) {
      // 📱 모바일 → redirect
      await signInWithRedirect(auth, provider);
      return;
    }

    // 🖥 PC → popup
    await signInWithPopup(auth, provider);
    // ❗ 이동은 onAuthStateChanged가 담당

  } catch (err) {
    console.error("🔥 Google 로그인 에러", err);

    if (!isMobile()) {
      alert("Google 로그인에 실패했습니다.");
    }

    googleLoginBtn.disabled = false;
  }
});

/* ===============================
   REDIRECT RESULT (모바일 복귀)
=============================== */

// ⚠️ 결과 판정 / 이동 ❌
// auth 상태 갱신 트리거용으로만 사용
getRedirectResult(auth).catch(() => {});

/* ===============================
   AUTH STATE (🔥 유일한 이동 관문)
=============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user || redirecting) return;

  redirecting = true;

  try {
    await ensureUserDoc(user);
    location.replace(REDIRECT_URL);

  } catch (err) {
    console.error("🔥 사용자 문서 처리 실패", err);

    if (!isMobile()) {
      alert("로그인 처리 중 오류가 발생했습니다.");
    }

    redirecting = false;
    googleLoginBtn && (googleLoginBtn.disabled = false);
  }
});
