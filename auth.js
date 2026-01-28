// auth.js
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const $ = id => document.getElementById(id);

/* 이메일 로그인 */
$("loginBtn").onclick = async () => {
  const email = $("email").value;
  const password = $("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("로그인 실패");
    console.error(e);
  }
};

/* Google 로그인 */
$("googleLoginBtn").onclick = async () => {
  const provider = new GoogleAuthProvider();

  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Google 로그인 실패:", e);
    alert(e.code);
  }
};



window.__auth = auth;
