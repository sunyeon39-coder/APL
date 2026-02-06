import { db, auth } from "./firebase.js";
import {
  doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const STATE_REF = doc(db, "boxboard", "state");
const layout = { seats:{}, waiting:[] };

const $ = id => document.getElementById(id);

function getBoxId(){
  return new URLSearchParams(location.search).get("boxId");
}

/* AUTH */
onAuthStateChanged(auth, user=>{
  if(!user) location.replace("login.html");
  subscribe();
});

/* FIRESTORE */
function subscribe(){
  const boxId = getBoxId();
  if(!boxId) return;

  onSnapshot(STATE_REF, snap=>{
    if(!snap.exists()) return;
    const box = snap.data().boxes?.find(b=>b.id===boxId);
    if(!box) return;
    layout.seats = box.layout?.seats || {};
    layout.waiting = box.layout?.waiting || [];
    render();
  });
}

/* RENDER */
function render(){
  const grid = $("layoutGrid");
  const wait = $("waitingList");

  grid.innerHTML="";
  Object.keys(layout.seats).forEach(n=>{
    const s = layout.seats[n];
    const el=document.createElement("div");
    el.className="card";
    el.textContent = s?.name || `Seat ${n}`;
    el.dataset.seat=n;
    grid.appendChild(el);
  });

  wait.innerHTML="";
  layout.waiting.forEach((w,i)=>{
    const el=document.createElement("div");
    el.className="card";
    el.textContent=w.name;
    el.dataset.wait=i;
    wait.appendChild(el);
  });
}

/* EVENTS */
$("addSeatBtn").onclick=()=>{
  const n = Date.now();
  layout.seats[n]={name:"비어있음",startedAt:Date.now()};
  save();
};

$("addWaitingBtn").onclick=()=>{
  const v=$("waitingNameInput").value.trim();
  if(!v) return;
  layout.waiting.push({name:v,startedAt:Date.now()});
  $("waitingNameInput").value="";
  save();
};

function save(){
  const boxId=getBoxId();
  getDoc(STATE_REF).then(snap=>{
    const boxes=snap.data().boxes;
    const i=boxes.findIndex(b=>b.id===boxId);
    boxes[i].layout={seats:layout.seats,waiting:layout.waiting};
    return setDoc(STATE_REF,{boxes},{merge:true});
  });
}
