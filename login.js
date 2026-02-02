// login.js — FINAL (ONLY Google Login / Mobile Safe)

import { auth, db } from "./firebase.js";
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

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (isMobile()) {
      // 📱 모바일 → redirect (필수)
      await signInWithRedirect(auth, provider);
    } else {
      // 🖥 PC → popup
      const cred = await signInWithPopup(auth, provider);
      await ensureUserDoc(cred.user);
      location.replace(REDIRECT_URL);
    }
  } catch (err) {
    console.error("Google 로그인 실패", err);
    showError("로그인에 실패했습니다.");
  }
});

/* =================================================
   MOBILE REDIRECT RESULT (🔥 필수)
================================================= */

getRedirectResult(auth)
  .then(async (result) => {
    if (!result?.user) return;

    await ensureUserDoc(result.user);
    location.replace(REDIRECT_URL);
  })
  .catch((err) => {
    console.error("Redirect 로그인 실패", err);
    showError("로그인에 실패했습니다.");
  });
