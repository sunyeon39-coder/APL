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

/* DOM */
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

const profileSection = document.getElementById("profileSection");
const tournamentSection = document.getElementById("tournamentSection");

const tournamentListEl = document.getElementById("tournamentList");
const emptyEl = document.getElementById("tournamentEmpty");

const joinModal = document.getElementById("joinModal");
const joinCodeInput = document.getElementById("joinCodeInput");
const joinConfirmBtn = document.getElementById("joinConfirmBtn");
const joinCancelBtn = document.getElementById("joinCancelBtn");
const joinError = document.getElementById("joinError");

/* STATE */
let currentUser = null;
let currentUserProfile = null;
let selectedTournamentId = null;

/* MENU */
menuBtn.onclick = () => {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
};
overlay.onclick = () => {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
};

/* PROFILE LOAD */
async function loadUserProfile(user){
  const ref = doc(db,"users",user.uid);
  const snap = await getDoc(ref);

  if(!snap.exists()){
    await setDoc(ref,{
      email:user.email || "",
      nickname:"",
      displayMode:"nickname",
      createdAt:serverTimestamp()
    });
    currentUserProfile = { nickname:"", displayMode:"nickname" };
  }else{
    currentUserProfile = snap.data();
  }
}

/* MODAL */
function openJoinModal(id){
  selectedTournamentId = id;
  joinCodeInput.value = "";
  joinError.classList.add("hidden");
  joinModal.classList.remove("hidden");
}
joinCancelBtn.onclick = () => joinModal.classList.add("hidden");

/* JOIN */
joinConfirmBtn.onclick = async ()=>{
  const code = joinCodeInput.value.trim();
  if(!code || !selectedTournamentId) return;

  const ref = doc(db,"tournaments",selectedTournamentId);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;

  const data = snap.data();
  if(data.joinCode !== code){
    joinError.textContent = "입장 코드가 올바르지 않습니다.";
    joinError.classList.remove("hidden");
    return;
  }

  const layout = data.layout || { waiting:[], seats:{} };
  const exists =
    layout.waiting.some(w=>w.uid===currentUser.uid) ||
    Object.values(layout.seats).some(s=>s?.uid===currentUser.uid);

  if(exists){
    joinError.textContent = "이미 입장되어 있습니다.";
    joinError.classList.remove("hidden");
    return;
  }

  layout.waiting.push({
    uid:currentUser.uid,
    displayName:
      currentUserProfile.displayMode==="nickname"
        ? currentUserProfile.nickname
        : currentUser.email,
    joinedAt:Date.now()
  });

  await setDoc(ref,{ layout },{ merge:true });
  location.href = `index.html?tournamentId=${selectedTournamentId}`;
};

/* RENDER */
function render(list){
  tournamentListEl.innerHTML="";
  if(!list.length){
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  list.forEach(t=>{
    const row=document.createElement("div");
    row.className="tournament-row";
    row.innerHTML=`<strong>${t.title}</strong>`;
    row.onclick=()=>openJoinModal(t.id);
    tournamentListEl.appendChild(row);
  });
}

/* SUBSCRIBE */
function subscribe(){
  const q=query(collection(db,"tournaments"),orderBy("title"));
  onSnapshot(q,snap=>{
    const arr=[];
    snap.forEach(d=>arr.push({id:d.id,...d.data()}));
    render(arr);
  });
}

/* AUTH */
onAuthStateChanged(auth, async user=>{
  if(!user){
    location.replace("login.html");
    return;
  }
  currentUser=user;
  await loadUserProfile(user);
  subscribe();
});
