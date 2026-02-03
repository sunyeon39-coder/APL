// login.js — FINAL (Google Only / Mobile Safe / No False Error)

import { auth, db } from "./public/firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =================================================
   CONFIG
================================================= */

const REDIRECT_URL = "hub.html";

/* admin 이메일 (선택) */
const ADMIN_EMAILS = [
  // "admin@example.com",
];

/* =================================================
   DOM
================================================= */

const googleLoginBtn = document.getElementById("googleLoginBtn");
const errorBox = document.getElementById("errorBox");

/* =================================================
   UTIL
================================================= */

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function showError(msg) {
  // 🔥 모바일에서는 절대 alert/에러 강제 표시 안 함
  if (isMobile()) {
    console.warn("모바일 로그인 에러 무시:", msg);
    return;
  }

  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

/* =================================================
   FIRESTORE USER DOC
================================================= */

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const isAdmin = ADMIN_EMAILS.includes(user.email);

  await setDoc(ref, {
    email: user.email,
    nickname: user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL || "",
    role: isAdmin ? "admin" : "user",
    createdAt: serverTimestamp(),
  });
}

/* =================================================
   GOOGLE LOGIN (BUTTON)
================================================= */

googleLoginBtn?.addEventListener("click", async () => {
  clearError();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    if (isMobile()) {
      /*
        📱 모바일:
        - redirect는 정상 동작 중에도 에러를 던질 수 있음
        - 여기서는 절대 실패 판단하지 않음
      */
      await signInWithRedirect(auth, provider);
      return; // 🔥 여기서 종료 (성공/실패 판단 금지)
    }

    /*
      🖥 PC:
      - popup은 즉시 결과를 받으므로 여기서 처리
    */
    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
    location.replace(REDIRECT_URL);

  } catch (err) {
    console.error("Google 로그인 에러", err);

    /*
      🔥 모바일 redirect 관련 에러는 전부 무시
      (auth/redirect-cancelled, auth/popup-closed-by-user 등)
    */
    if (isMobile()) return;

    showError("로그인에 실패했습니다.");
  }
});

/* =================================================
   MOBILE REDIRECT RESULT (🔥 유일한 판정자)
================================================= */

getRedirectResult(auth)
  .then(async (result) => {
    if (!result || !result.user) return;

    await ensureUserDoc(result.user);
    location.replace(REDIRECT_URL);
  })
  .catch((err) => {
    /*
      🔥 여기서도 모바일은 절대 alert 안 띄움
      (Safari / Chrome에서 false error 빈번)
    */
    console.warn("redirect 결과 에러 (무시)", err);
  });
