// login.js — FINAL STABLE
// - Firebase Hosting ONLY
// - PC: popup / Mobile: redirect
// - Single authority for login
// - Firestore user doc ensured
// - No false mobile errors

import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONFIG
=============================== */

const REDIRECT_URL = "hub.html";
const ADMIN_EMAILS = [
  // "admin@example.com",
];

/* ===============================
   STATE
=============================== */

let handled = false; // 🔥 중복 처리 방지

/* ===============================
   DOM
=============================== */

const loginBtn = document.getElementById("googleLoginBtn");
const errorBox = document.getElementById("errorBox");

/* ===============================
   UTIL
=============================== */

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function showError(msg) {
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

/* ===============================
   FIRESTORE USER DOC
=============================== */

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

/* ===============================
   LOGIN BUTTON
=============================== */

loginBtn?.addEventListener("click", async () => {
  clearError();
  loginBtn.disabled = true;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    if (isMobile()) {
      console.log("📱 mobile → redirect login");
      await signInWithRedirect(auth, provider);
      return; // 🔥 판정은 redirect 결과에서만
    }

    console.log("🖥 PC → popup login");
    const cred = await signInWithPopup(auth, provider);
    handled = true;
    await ensureUserDoc(cred.user);
    location.replace(REDIRECT_URL);

  } catch (err) {
    console.error("로그인 에러", err);
    loginBtn.disabled = false;
    if (!isMobile()) showError("로그인에 실패했습니다.");
  }
});

/* ===============================
   REDIRECT RESULT (MOBILE)
=============================== */

getRedirectResult(auth)
  .then(async (result) => {
    if (!result?.user || handled) return;

    console.log("🔁 redirect result user:", result.user.email);
    handled = true;
    await ensureUserDoc(result.user);
    location.replace(REDIRECT_URL);
  })
  .catch((err) => {
    console.warn("redirect 결과 에러 (무시)", err);
  });

/* ===============================
   ALREADY LOGGED IN
=============================== */

onAuthStateChanged(auth, (user) => {
  if (!user || handled) return;

  console.log("✅ already logged in:", user.email);
  handled = true;
  location.replace(REDIRECT_URL);
});
