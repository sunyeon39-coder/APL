console.log("🔥 layout_app.js STABLE BOOT");

import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= STATE ================= */
const STATE_REF = doc(db, "boxboard", "state");

let role = "user";
let selectedWaiting = null;
let isSaving = false;
let unsub = null;

const layout = {
  seats: {},
  waiting: []
};

const $ = id => document.getElementById(id);

/* ================= UTIL ================= */
function getBoxId(){
  return new URLSearchParams(location.search).get("boxId");
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  role = snap.exists() ? snap.data().role || "user" : "user";

  bindUI();
  listen();
});

/* ================= FIRESTORE ================= */
function listen(){
  const boxId = getBoxId();
  if (!boxId || unsub) return;

  unsub = onSnapshot(STATE_REF, snap => {
    if (!snap.exists() || isSaving) return;

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box || !box.layout) return;

    layout.seats = structuredClone(box.layout.seats || {});
    layout.waiting = structuredClone(box.layout.waiting || []);

    render();
  });
}

/* ================= RENDER ================= */
function render(){
  renderSeats();
  renderWaiting();
}

function renderSeats(){
  const grid = $("layoutGrid");
  grid.innerHTML = "";

  Object.keys(layout.seats).sort().forEach(num => {
    const p = layout.seats[num];
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.seat = num;

    el.innerHTML = `
      ${role==="admin" ? `<button class="seat-delete">×</button>`:""}
      <div class="badge">Seat ${num}</div>
      <h3>${p ? p.name : "비어있음"}</h3>
    `;
    grid.appendChild(el);
  });
}

function renderWaiting(){
  const list = $("waitingList");
  list.innerHTML = "";

  layout.waiting.forEach((w,i)=>{
    const el = document.createElement("div");
    el.className = "card";
    if(i===selectedWaiting) el.classList.add("selected");
    el.dataset.index = i;

    el.innerHTML = `
      <h3>${w.name}</h3>
      ${role==="admin"?`<button class="wait-delete">×</button>`:""}
    `;
    list.appendChild(el);
  });
}

/* ================= EVENTS ================= */
function bindUI(){

  $("addSeatBtn")?.addEventListener("click",()=>{
    if(role!=="admin") return;
    const next = Object.keys(layout.seats).length + 1;
    layout.seats[next] = null;
    save();
  });

  $("addWaitingBtn")?.addEventListener("click",()=>{
    const name = $("waitingNameInput").value.trim();
    if(!name) return;
    layout.waiting.push({name});
    $("waitingNameInput").value="";
    save();
  });

  document.addEventListener("click",e=>{
    const w = e.target.closest(".waiting-list .card");
    if(w && role==="admin"){
      selectedWaiting = Number(w.dataset.index);
      renderWaiting();
      return;
    }

    const seat = e.target.closest(".seat-grid .card");
    if(seat && selectedWaiting!==null && role==="admin"){
      const seatNum = seat.dataset.seat;
      const incoming = layout.waiting[selectedWaiting];
      layout.seats[seatNum] = incoming;
      layout.waiting.splice(selectedWaiting,1);
      selectedWaiting=null;
      save();
    }

    if(e.target.classList.contains("seat-delete")){
      const s = e.target.closest(".card").dataset.seat;
      delete layout.seats[s];
      save();
    }

    if(e.target.classList.contains("wait-delete")){
      const i = e.target.closest(".card").dataset.index;
      layout.waiting.splice(i,1);
      save();
    }
  });
}

/* ================= SAVE ================= */
function save(){
  const boxId = getBoxId();
  if(!boxId) return;

  isSaving = true;

  getDoc(STATE_REF).then(snap=>{
    const boxes = snap.data().boxes || [];
    const idx = boxes.findIndex(b=>b.id===boxId);
    if(idx===-1) return;

    boxes[idx] = {
      ...boxes[idx],
      layout: {
        seats: layout.seats,
        waiting: layout.waiting
      }
    };

    return setDoc(STATE_REF,{boxes},{merge:true});
  }).finally(()=>{
    setTimeout(()=>isSaving=false,50);
  });
}
