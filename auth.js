// auth.js — FINAL (Single Redirect Authority + Mobile SAFE)

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

  if (snap.exists()) {
    // 재로그인 시 마지막 로그인만 갱신
    await setDoc(
      ref,
      { lastLoginAt: serverTimestamp() },
      { merge: true }
    );
    return;
  }

  // 최초 로그인
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
   🔥 1. 페이지 로드 즉시 로그인 상태 확인 (모바일 핵심)
=============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user || redirecting) return;

  redirecting = true;

  try {
    await ensureUserDoc(user);
    location.replace(REDIRECT_URL);
  } catch (err) {
    console.error("🔥 사용자 문서 처리 실패", err);
    redirecting = false;
  }
});

/* ===============================
   🔥 2. redirect 결과 처리 (모바일 복귀 보조)
=============================== */

// ⚠️ 이동은 여기서 하지 않음 (중복 방지)
getRedirectResult(auth).catch(() => {});

/* ===============================
   🔥 3. LOGIN BUTTON
=============================== */

const googleLoginBtn = document.getElementById("googleLoginBtn");

googleLoginBtn?.addEventListener("click", async () => {
  googleLoginBtn.disabled = true;

  // persistence는 먼저 (iOS Safari 필수)
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  try {
    if (isMobile()) {
      // 📱 모바일: redirect ONLY (가장 안정적)
      await signInWithRedirect(auth, provider);
      return;
    }

    // 🖥 데스크톱: popup
    await signInWithPopup(auth, provider);
    // 이동은 onAuthStateChanged가 담당

  } catch (err) {
    console.error("🔥 Google 로그인 에러", err);

    if (!isMobile()) {
      alert("Google 로그인에 실패했습니다.");
    }

    googleLoginBtn.disabled = false;
  }
});
