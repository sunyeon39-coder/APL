import { db, auth } from "./firebase.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* DOM */
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

const views = {
  profile: document.getElementById("view-profile"),
  tournaments: document.getElementById("view-tournaments")
};

const listEl = document.getElementById("tournamentList");
const emptyEl = document.getElementById("tournamentEmpty");

const nicknameInput = document.getElementById("nicknameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");

/* Menu */
menuBtn.onclick = () => {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
};
overlay.onclick = closeMenu;

function closeMenu(){
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
}

sideMenu.onclick = (e) => {
  const li = e.target.closest("li[data-view]");
  if(!li) return;

  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[li.dataset.view].classList.remove("hidden");
  closeMenu();
};

/* Default view */
Object.values(views).forEach(v => v.classList.add("hidden"));
views.tournaments.classList.remove("hidden");

/* ===============================
   USER PROFILE
   =============================== */
let currentUser = null;
let userRef = null;

async function loadUserProfile(user){
  userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if(!snap.exists()){
    // 최초 생성
    await setDoc(userRef, {
      email: user.email || "",
      nickname: "",
      displayMode: "nickname",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    nicknameInput.value = "";
    document.querySelector('input[value="nickname"]').checked = true;
    return;
  }

  const data = snap.data();
  nicknameInput.value = data.nickname || "";
  document.querySelector(
    `input[value="${data.displayMode || "nickname"}"]`
  ).checked = true;
}

saveProfileBtn.onclick = async () => {
  if(!currentUser) return;

  const nickname = nicknameInput.value.trim();
  const displayMode =
    document.querySelector("input[name=displayMode]:checked").value;

  await setDoc(userRef, {
    nickname,
    displayMode,
    updatedAt: serverTimestamp()
  }, { merge:true });

  alert("프로필이 저장되었습니다");
};

/* ===============================
   TOURNAMENTS
   =============================== */
function render(list){
  listEl.innerHTML = "";
  if(!list.length){
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  list.forEach(t => {
    const row = document.createElement("article");
    row.className = "tournament-row";
    row.innerHTML = `
      <div class="t-logo ${t.theme || ""}">
        ${t.logoUrl ? `<img src="${t.logoUrl}">` : "LOGO"}
      </div>
      <div class="t-info">
        <h3>${t.title}</h3>
        <p class="location">${t.location || ""}</p>
        <p class="date">${t.startDate} ~ ${t.endDate}</p>
      </div>
    `;
    row.onclick = () => {
      location.href = `index.html?tournamentId=${t.id}`;
    };
    listEl.appendChild(row);
  });
}

function subscribeTournaments(){
  const q = query(collection(db,"tournaments"), orderBy("title"));
  onSnapshot(q, snap => {
    const arr = [];
    snap.forEach(doc => arr.push({ id:doc.id, ...doc.data() }));
    render(arr);
  });
}

/* ===============================
   AUTH GUARD
   =============================== */
onAuthStateChanged(auth, async user => {
  if(!user){
    location.replace("login.html");
    return;
  }
  currentUser = user;
  await loadUserProfile(user);
  subscribeTournaments();
});
