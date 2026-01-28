import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔐 관리자 코드 (원하면 바꿔) */
const ADMIN_CODE = "HAN-ADMIN-2026";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const passwordConfirmInput = document.getElementById("passwordConfirmInput");
const adminCodeInput = document.getElementById("adminCodeInput");
const signupBtn = document.getElementById("signupBtn");
const errorMsg = document.getElementById("errorMsg");

signupBtn.addEventListener("click", signup);

async function signup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = passwordConfirmInput.value;
  const adminCode = adminCodeInput.value.trim();

  errorMsg.textContent = "";

  if (!email || !password || !confirm) {
    errorMsg.textContent = "모든 필드를 입력하세요.";
    return;
  }

  if (password.length < 6) {
    errorMsg.textContent = "비밀번호는 6자 이상이어야 합니다.";
    return;
  }

  if (password !== confirm) {
    errorMsg.textContent = "비밀번호가 일치하지 않습니다.";
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = "가입 중…";

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const role =
      adminCode === ADMIN_CODE
        ? "admin"
        : "user";

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      role,
      createdAt: serverTimestamp()
    });

    alert("회원가입 완료! 로그인 해주세요.");
    location.replace("login.html");

  } catch (err) {
    console.error(err);
    errorMsg.textContent = getErrorMessage(err.code);
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = "회원가입";
  }
}

function getErrorMessage(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/weak-password":
      return "비밀번호가 너무 약합니다.";
    default:
      return "회원가입에 실패했습니다.";
  }
}
