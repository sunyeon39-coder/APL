import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const REDIRECT_URL = "hub.html";
const googleLoginBtn = document.getElementById("googleLoginBtn");

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

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
  });
}

/* 🔥 로그인 버튼 */
googleLoginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // 🔥 persistence는 await 없이
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  if (isMobile()) {
    signInWithRedirect(auth, provider);
    return;
  }

  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user);
  location.replace(REDIRECT_URL);
});

/* 🔥 redirect 결과 처리 (유일한 판정자) */
getRedirectResult(auth)
  .then(async result => {
    if (!result?.user) return;
    await ensureUserDoc(result.user);
    location.replace(REDIRECT_URL);
  })
  .catch(() => {
    // 모바일에서는 절대 실패 alert 띄우지 않음
  });
