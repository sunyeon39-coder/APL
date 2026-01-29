// login.js — FINAL (UI + Firebase Auth + Nickname Signup)

import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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

// admin 이메일 (필요 시)
const ADMIN_EMAILS = [
  // "admin@example.com",
];

/* =================================================
   DOM
================================================= */

const $ = (id) => document.getElementById(id);

const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const nicknameInput = $("nicknameInput");

const loginBtn = $("loginBtn");
const googleLoginBtn = $("googleLoginBtn");

const title = $("authTitle");
const toggleText = $("toggleText");
const toggleBtn = $("toggleMode");
const signupOnlyEls = document.querySelectorAll(".signup-only");

const errorBox = $("errorBox");

/* =================================================
   UI MODE (login / signup)
================================================= */

let mode = "login";

function showError(msg){
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError(){
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

function renderMode(){
  clearError();

  if(mode === "login"){
    title.textContent = "로그인";
    toggleText.textContent = "계정이 없나요?";
    toggleBtn.textContent = "회원가입";
    signupOnlyEls.forEach(el => el.style.display = "none");
  }else{
    title.textContent = "회원가입";
    toggleText.textContent = "이미 계정이 있나요?";
    toggleBtn.textContent = "로그인";
    signupOnlyEls.forEach(el => el.style.display = "block");
  }
}

toggleBtn.addEventListener("click", e => {
  e.preventDefault();
  mode = mode === "login" ? "signup" : "login";
  renderMode();
});

renderMode();

/* =================================================
   FIRESTORE USER DOC
================================================= */

async function ensureUserDoc(user, nicknameFromSignup = null){
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const isAdmin = ADMIN_EMAILS.includes(user.email);

  await setDoc(ref, {
    email: user.email,
    nickname:
      nicknameFromSignup ||
      user.displayName ||
      user.email.split("@")[0],
    role: isAdmin ? "admin" : "user",
    createdAt: serverTimestamp(),
  });
}

/* =================================================
   LOGIN / SIGNUP (EMAIL)
================================================= */

loginBtn.addEventListener("click", async () => {
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const nickname = nicknameInput?.value.trim();

  if (!email || !password) {
    showError("이메일과 비밀번호를 입력하세요.");
    return;
  }

  try {
    if (mode === "login") {
      // 🔐 로그인
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      location.replace(REDIRECT_URL);
    } else {
      // 🆕 회원가입
      if (!nickname) {
        showError("닉네임을 입력하세요.");
        return;
      }
      if (password.length < 6) {
        showError("비밀번호는 6자 이상이어야 합니다.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user, nickname);
      location.replace(REDIRECT_URL);
    }
  } catch (err) {
    showError(err.message);
  }
});

/* =================================================
   GOOGLE LOGIN
================================================= */

googleLoginBtn.addEventListener("click", async () => {
  clearError();

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
    location.replace(REDIRECT_URL);
  } catch (err) {
    showError(err.message);
  }
});

/* =================================================
   ENTER KEY SUPPORT
================================================= */

document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;

  if (
    document.activeElement === emailInput ||
    document.activeElement === passwordInput ||
    document.activeElement === nicknameInput
  ) {
    loginBtn.click();
  }
});
