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
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM
=============================== */
const tournamentListEl = document.getElementById("tournamentList");
const emptyEl = document.getElementById("tournamentEmpty");

const joinModal = document.getElementById("joinModal");
const joinCodeInput = document.getElementById("joinCodeInput");
const joinConfirmBtn = document.getElementById("joinConfirmBtn");
const joinCancelBtn = document.getElementById("joinCancelBtn");
const joinError = document.getElementById("joinError");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let currentUserProfile = null;
let selectedTournamentId = null;

/* ===============================
   USER PROFILE LOAD
=============================== */
async function loadUserProfile(user){
  const ref = doc(db,"users",user.uid);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    await setDoc(ref,{
      email:user.email || "",
      nickname:"",
      displayMode:"nickname",
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    currentUserProfile = { nickname:"", displayMode:"nickname" };
    return;
  }
  currentUserProfile = snap.data();
}

/* ===============================
   MODAL CONTROL
=============================== */
function openJoinModal(tournamentId){
  selectedTournamentId = tournamentId;
  joinCodeInput.value = "";
  joinError.classList.add("hidden");
  joinModal.classList.remove("hidden");
  joinCodeInput.focus();
}

function closeJoinModal(){
  joinModal.classList.add("hidden");
  selectedTournamentId = null;
}

joinCancelBtn.onclick = closeJoinModal;

/* ===============================
   JOIN CONFIRM
=============================== */
joinConfirmBtn.onclick = async () => {
  const code = joinCodeInput.value.trim();
  if(!code || !selectedTournamentId || !currentUser) return;

  try{
    const tRef = doc(db,"tournaments",selectedTournamentId);
    const snap = await getDoc(tRef);
    if(!snap.exists()) return;

    const data = snap.data();
    if(data.joinCode !== code){
      joinError.textContent = "입장 코드가 올바르지 않습니다.";
      joinError.classList.remove("hidden");
      return;
    }

    const layout = data.layout || { waiting:[], seats:{} };

    // 🔒 중복 방지
    const alreadyWaiting = layout.waiting?.some(w => w.uid === currentUser.uid);
    const alreadySeated = Object.values(layout.seats || {})
      .some(s => s.uid === currentUser.uid);

    if(alreadyWaiting || alreadySeated){
      joinError.textContent = "이미 입장되어 있습니다.";
      joinError.classList.remove("hidden");
      return;
    }

    // 표시 이름 결정
    const displayName =
      currentUserProfile.displayMode === "nickname"
        ? currentUserProfile.nickname
        : currentUser.displayName || currentUser.email;

    layout.waiting.push({
      uid: currentUser.uid,
      displayName,
      joinedAt: Date.now()
    });

    await setDoc(tRef,{ layout },{ merge:true });

    // 성공 → 이동
    location.href = `index.html?tournamentId=${selectedTournamentId}`;

  }catch(err){
    console.error(err);
    joinError.textContent = "처리 중 오류가 발생했습니다.";
    joinError.classList.remove("hidden");
  }
};

/* ===============================
   RENDER TOURNAMENTS
=============================== */
function render(list){
  tournamentListEl.innerHTML = "";

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
    row.onclick = () => openJoinModal(t.id);
    tournamentListEl.appendChild(row);
  });
}

/* ===============================
   SUBSCRIBE TOURNAMENTS
=============================== */
function subscribeTournaments(){
  const q = query(collection(db,"tournaments"), orderBy("title"));
  onSnapshot(q,snap=>{
    const arr=[];
    snap.forEach(d=>arr.push({ id:d.id, ...d.data() }));
    render(arr);
  });
}

/* ===============================
   AUTH GUARD
=============================== */
onAuthStateChanged(auth, async user=>{
  if(!user){
    location.replace("login.html");
    return;
  }
  currentUser = user;
  await loadUserProfile(user);
  subscribeTournaments();
});
