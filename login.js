// login.js — FINAL STABLE (LOOP FIXED)
// - PC: popup, Mobile(iOS/Android): redirect
// - getRedirectResult 우선 처리 + onAuthStateChanged fallback
// - users/{uid} 문서가 없더라도 이후 페이지에서 루프가 생기지 않도록 보강(허브에서도 생성)
// - UI/레이아웃 변경 없음

import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
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

const REDIRECT_URL = "/hub";

/* (선택) 특정 이메일을 admin으로 자동 부여하고 싶으면 여기에 추가 */
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

function isMobileLike() {
  // iOS Safari, Android WebView/Chrome 등에서 popup이 막히는 경우가 많아서 redirect 사용
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

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

/* ===============================
   FIRESTORE USER DOC
=============================== */

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    // rules/권한 문제 등: 여기서는 상세 표시(로그인 페이지)
    console.error("❌ users getDoc failed:", e);
    throw e;
  }

  if (snap.exists()) return;

  const isAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());

  await setDoc(
    ref,
    {
      email: user.email || "",
      nickname: user.displayName || (user.email ? user.email.split("@")[0] : "user"),
      photoURL: user.photoURL || "",
      role: isAdmin ? "admin" : "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ===============================
   NAV
=============================== */
function goHub() {
  // login.html 기록 제거 (뒤로가기 시 로그인 화면으로 안 돌아가게)
  location.replace(REDIRECT_URL);
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
  try {
    // 🔥 iOS/Safari에서 redirect 후 세션이 풀려 로그인 화면으로 되돌아오는 문제 완화
    // - 우선 localPersistence 시도
    // - 실패 시 sessionPersistence로 폴백
    try{
      await setPersistence(auth, browserLocalPersistence);
    }catch(e){
      try{ await setPersistence(auth, browserSessionPersistence); }catch(_){}
    }

    if (isMobileLike()) {
      console.log("📱 mobile → redirect login");
      sessionStorage.setItem("__bb_redirect_pending", "1");
      await signInWithRedirect(auth, provider);
      return;
    }

    console.log("🖥 PC → popup login");
    const cred = await signInWithPopup(auth, provider);
    handled = true;
    await ensureUserDoc(cred.user);
    goHub();

  } catch (err) {
    console.error("❌ login error", err);
    if (loginBtn) loginBtn.disabled = false;

    // 모바일은 redirect로 다시 돌아오는 과정에서 에러가 콘솔에 찍힐 수 있어서,
    // 사용자에게는 PC에서만 메시지를 명확히 표시
    if (!isMobileLike()) showError("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
});

/* ===============================
   REDIRECT RESULT (MOBILE)
=============================== */

getRedirectResult(auth)
  .then(async (result) => {
    // redirect 결과가 없는 경우(null)도 정상일 수 있음
    if (!result?.user || handled) return;

    console.log("🔁 redirect result user:", result.user.email);
    handled = true;

    try {
      await ensureUserDoc(result.user);
    } catch (e) {
      // rules/권한 문제 등
      showError("로그인 권한 확인 중 오류가 발생했습니다.");
      if (loginBtn) loginBtn.disabled = false;
      return;
    }

    goHub();
  })
  .catch((err) => {
    // iOS/Safari에서 redirect 결과 처리 중 내부 오류 로그가 발생하는 경우가 있어,
    // 여기서는 치명적인 경우만 사용자에게 표시
    console.warn("⚠️ redirect result error:", err);
    // 사용자에게는 과도한 알림을 하지 않음
  })
  .finally(() => {
    sessionStorage.removeItem("__bb_redirect_pending");
  });

/* ===============================
   ALREADY LOGGED IN (FALLBACK)
=============================== */

onAuthStateChanged(auth, async (user) => {
  if (!user || handled) return;

  // redirect 직후에는 getRedirectResult가 먼저 처리되도록 한 템포 양보
  // (일부 브라우저에서 순서 경합 방지)
  queueMicrotask(async () => {
    if (!user || handled) return;

    console.log("✅ already logged in:", user.email);
    handled = true;

    try {
      await ensureUserDoc(user);
    } catch (e) {
      // 그래도 허브에서 한 번 더 보정하므로 여기서는 최소 표시
      console.warn("⚠️ ensureUserDoc failed in login fallback:", e);
    }

    goHub();
  });
});
