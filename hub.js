// hub.js — USER PROFILE HUB (SKELETON)

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   DOM
=============================== */
const nicknameInput = document.getElementById("nicknameInput");
const saveBtn = document.getElementById("saveProfileBtn");
const msg = document.getElementById("profileMsg");
const radios = document.querySelectorAll("input[name='displayMode']");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let userRef = null;

/* ===============================
   AUTH
=============================== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  currentUser = user;
  userRef = doc(db, "users", user.uid);

  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();

  nicknameInput.value = data.nickname || "";
  const mode = data.displayMode || "nickname";

  radios.forEach(r => {
    r.checked = r.value === mode;
  });
});

/* ===============================
   SAVE PROFILE
=============================== */
saveBtn.addEventListener("click", async () => {
  if (!userRef) return;

  const nickname = nicknameInput.value.trim();
  const displayMode =
    document.querySelector("input[name='displayMode']:checked")?.value;

  if (!nickname) {
    showMsg("닉네임을 입력하세요.", true);
    return;
  }

  await updateDoc(userRef, {
    nickname,
    displayMode
  });

  showMsg("저장되었습니다.");
});

function showMsg(text, isError=false){
  msg.textContent = text;
  msg.style.display = "block";
  msg.style.color = isError ? "#ff5c7c" : "#4aa3ff";
}

/* ===============================
   TOURNAMENT CARD CLICK (TEMP)
=============================== */
document.querySelectorAll(".tournament-card").forEach(card => {
  card.addEventListener("click", () => {
    const id = card.dataset.id;

    // 🔧 지금은 임시
    localStorage.setItem("selectedTournamentId", id);
    location.href = "index.html";
  });
});
