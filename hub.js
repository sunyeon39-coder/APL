import { db, auth } from "./firebase.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy
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

/* Render */
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

/* Firestore */
function subscribeTournaments(){
  const q = query(collection(db,"tournaments"), orderBy("title"));
  onSnapshot(q, snap => {
    const arr = [];
    snap.forEach(doc => arr.push({ id:doc.id, ...doc.data() }));
    render(arr);
  });
}

/* Auth guard */
onAuthStateChanged(auth, user => {
  if(!user){
    location.replace("login.html");
    return;
  }
  subscribeTournaments();
});

/* Profile save (stub) */
document.getElementById("saveProfileBtn")?.addEventListener("click",()=>{
  const nickname = document.getElementById("nicknameInput").value.trim();
  const mode = document.querySelector("input[name=displayMode]:checked").value;
  console.log("SAVE PROFILE:", { nickname, mode });
});
