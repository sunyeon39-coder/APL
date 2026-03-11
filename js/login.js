import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup
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

document.querySelectorAll(".gender-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".gender-btn").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    selectedGender = btn.dataset.gender || "none";
  });
});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const uid = user.uid;

    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      signupModal.classList.remove("hidden");
      return;
    }

    await updateDoc(userRef, {
      email: user.email || "",
      lastLogin: serverTimestamp()
    });

    location.href = "./hub.html";
  } catch (error) {
    console.error("login error:", error);
    alert("로그인 실패");
  }
}

async function saveProfile() {
  try {
    const nickname = document.getElementById("nicknameInput").value.trim();
    const phone = document.getElementById("phoneInput").value.trim();

    if (nickname.length < 2 || nickname.length > 7) {
      alert("닉네임은 2~7자로 입력해주세요.");
      return;
    }

    if (!auth.currentUser) {
      alert("로그인 정보가 없습니다. 다시 시도해주세요.");
      return;
    }

    const user = auth.currentUser;
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

    location.href = "./hub.html";
  } catch (error) {
    console.error("save profile error:", error);
    alert("회원 정보 저장 실패");
  }
}

googleBtn?.addEventListener("click", login);
signupConfirm?.addEventListener("click", saveProfile);