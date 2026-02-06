// login.js — GOOGLE LOGIN (MOBILE SAFE / SYNTAX FIXED)

import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   CONFIG
=============================== */
const REDIRECT_URL = "/hub";

/* ===============================
   PROVIDER
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

/* ===============================
   DOM
=============================== */
const googleBtn = document.getElementById("googleLoginBtn");

/* ===============================
   LOGIN CLICK
=============================== */
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      googleBtn.disabled = true;

      // 🔥 모바일 / Safari redirect 안정화
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch (_) {}
      }

      await signInWithRedirect(auth, provider);

    } catch (err) {
      console.error("❌ Google login error:", err);
      googleBtn.disabled = false;
    }
  });
}

/* ===============================
   REDIRECT RESULT
=============================== */
getRedirectResult(auth)
  .then(() => {
    // 결과는 onAuthStateChanged에서 처리
  })
  .catch(err => {
    console.error("❌ Redirect result error:", err);
  });

/* ===============================
   AUTH STATE
=============================== */
onAuthStateChanged(auth, user => {
  if (user) {
    location.replace(REDIRECT_URL);
  }
});
