import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const googleBtn = document.getElementById("googleLogin");
const signupModal = document.getElementById("signupModal");
const signupConfirm = document.getElementById("signupConfirm");

let selectedGender = "none";
let pendingUser = null;

/* ===============================
   GENDER UI
=============================== */
document.querySelectorAll(".gender-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".gender-btn").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    selectedGender = btn.dataset.gender || "none";
  });
});

/* ===============================
   GOOGLE PROVIDER
=============================== */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

/* ===============================
   ENV CHECK
=============================== */
function isMobileLike() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 900;
}

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line|NAVER|Whale/i.test(ua);
}

function showError(error, fallback = "알 수 없는 오류") {
  const code = error?.code || "";
  const message = error?.message || fallback;
  console.error("auth error:", error);
  alert(`로그인 실패\n${code || message}`);
}

function goHub() {
  location.href = "./hub.html";
}

/* ===============================
   LOGIN FINISH
=============================== */
async function finishLogin(user) {
  if (!user) return;

  pendingUser = user;

  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  // 첫 로그인 사용자
  if (!snap.exists()) {
    signupModal.classList.remove("hidden");
    return;
  }

  // 기존 사용자
  await updateDoc(userRef, {
    email: user.email || "",
    lastLogin: serverTimestamp()
  });

  goHub();
}

/* ===============================
   REDIRECT RESULT
=============================== */
async function handleRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);

    if (!result || !result.user) return;

    await finishLogin(result.user);
  } catch (error) {
    showError(error);
  }
}

/* ===============================
   LOGIN CLICK
=============================== */
async function login() {
  try {
    if (isInAppBrowser()) {
      alert("카카오톡/인스타 앱 내부 브라우저에서는 로그인이 실패할 수 있습니다.\n사파리 또는 크롬에서 다시 열어주세요.");
      return;
    }

    if (isMobileLike()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    const result = await signInWithPopup(auth, provider);
    await finishLogin(result.user);
  } catch (error) {
    showError(error);
  }
}

/* ===============================
   FIRST SIGNUP SAVE
=============================== */
async function saveProfile() {
  try {
    const nickname = document.getElementById("nicknameInput")?.value.trim() || "";
    const phone = document.getElementById("phoneInput")?.value.trim() || "";
    const user = auth.currentUser || pendingUser;

    if (nickname.length < 2 || nickname.length > 7) {
      alert("닉네임은 2~7자로 입력해주세요.");
      return;
    }

    if (!user) {
      alert("로그인 정보가 없습니다. 다시 시도해주세요.");
      return;
    }

    const uid = user.uid;

    await setDoc(doc(db, "users", uid), {
      email: user.email || "",
      nickname,
      phone,
      gender: selectedGender,
      role: "user",
      accessCode: "",
      allowedEvents: {},
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

    goHub();
  } catch (error) {
    console.error("save profile error:", error);
    alert(`회원 정보 저장 실패\n${error.code || error.message || "알 수 없는 오류"}`);
  }
}

/* ===============================
   INIT
=============================== */
handleRedirectLogin();

googleBtn?.addEventListener("click", login);
signupConfirm?.addEventListener("click", saveProfile);