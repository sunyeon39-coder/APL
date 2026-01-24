/* =====================================================
   BOX BOARD — CLEAN SINGLE-STRUCTURE VERSION (FINAL)
   ===================================================== */
import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONST
   =============================== */
const STATE_REF = doc(db, "boxboard", "state");
const LS_KEY = "boxboard_v1_state";

/* ===============================
   FLAGS
   =============================== */
let isApplyingRemoteState = false;

/* ===============================
   STATE
   =============================== */
let state = {
  dateText: "",
  boxes: [],
  view: "main",        // main | layout
  currentBoxId: null,
};

let currentTab = "box";
let editingBoxId = null;

/* ===============================
   UTIL
   =============================== */
const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now();
const isTyping = (el) =>
  el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

/* ===============================
   DOM
   =============================== */
const appEl = document.getElementById("app");
const boardEl = document.getElementById("board");
const dateTextEl = document.getElementById("dateText");

const overlayText = document.getElementById("overlayText");
const overlayBox = document.getElementById("overlayBox");

const inputDateText = document.getElementById("inputDateText");
const saveTextBtn = document.getElementById("saveText");
const closeTextBtn = document.getElementById("closeText");

const addBoxBtn = document.getElementById("addBoxBtn");
const boxTitle = document.getElementById("boxTitle");
const boxStatus = document.getElementById("boxStatus");
const boxBuyin = document.getElementById("boxBuyin");
const boxTime = document.getElementById("boxTime");
const boxExtraLabel = document.getElementById("boxExtraLabel");
const boxExtraValue = document.getElementById("boxExtraValue");
const saveBoxBtn = document.getElementById("saveBox");
const cancelBoxBtn = document.getElementById("cancelBox");

/* ===============================
   STORAGE
   =============================== */
async function saveState(){
  if (isApplyingRemoteState) return;

  const payload = {
    dateText: state.dateText,
    boxes: state.boxes,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(STATE_REF, payload, { merge: true });
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("saveState failed", e);
  }
}

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if(parsed.dateText) state.dateText = parsed.dateText;
    if(Array.isArray(parsed.boxes)) state.boxes = parsed.boxes;
    return true;
  }catch(e){
    return false;
  }
}

/* ===============================
   FIRESTORE SUBSCRIBE
   =============================== */
function subscribeState(){
  onSnapshot(STATE_REF, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    isApplyingRemoteState = true;

    state.dateText = data.dateText || "";
    state.boxes = Array.isArray(data.boxes) ? data.boxes : [];

    render();

    isApplyingRemoteState = false;
  });
}

/* ===============================
   MODALS
   =============================== */
function openTextModal(){
  inputDateText.value = state.dateText || "";
  overlayText.classList.remove("hidden");
  setTimeout(()=>inputDateText.focus(),0);
}
function closeTextModal(){
  overlayText.classList.add("hidden");
}

function openBoxModal(box=null){
  overlayBox.classList.remove("hidden");
  editingBoxId = box?.id || null;

  boxTitle.value = box?.title || "";
  boxStatus.value = box?.status || "Opened";
  boxBuyin.value = box?.buyin || "";
  boxTime.value = box?.time || "";
  boxExtraLabel.value = box?.extraLabel || "Entries";
  boxExtraValue.value = box?.extraValue || "";

  setTimeout(()=>boxTitle.focus(),0);
}
function closeBoxModal(){
  overlayBox.classList.add("hidden");
  editingBoxId = null;
}

/* ===============================
   NAV
   =============================== */
function backToMain(){
  state.view = "main";
  state.currentBoxId = null;
  currentTab = "box";
  render();
}

/* ===============================
   RENDER
   =============================== */
function renderHeader(){
  dateTextEl.textContent = state.dateText || "";
}

function statusClass(s){
  s = (s||"").toLowerCase();
  if(s==="running") return "running";
  if(s==="closed") return "closed";
  return "opened";
}

function renderMain(){
  boardEl.innerHTML = "";

  state.boxes.forEach(b=>{
    const card = document.createElement("section");
    card.className = `card ${statusClass(b.status)}`;
    card.dataset.id = b.id;

    card.innerHTML = `
      <div class="badge">${b.status}</div>
      <h3 class="card-title">${b.title}</h3>
      <div class="meta">
        <div class="pill"><div class="k">Buy-in</div><div class="v">${b.buyin}</div></div>
        <div class="pill"><div class="k">Time</div><div class="v">${b.time}</div></div>
        <div class="pill"><div class="k">${b.extraLabel}</div><div class="v">${b.extraValue}</div></div>
      </div>
    `;

    boardEl.appendChild(card);
  });
}

function render(){
  renderHeader();
  renderMain();
}

/* ===============================
   EVENTS
   =============================== */
saveTextBtn.onclick = ()=>{
  state.dateText = inputDateText.value.trim();
  saveState();
  closeTextModal();
  renderHeader();
};

closeTextBtn.onclick = closeTextModal;

addBoxBtn.onclick = ()=>openBoxModal(null);
cancelBoxBtn.onclick = closeBoxModal;

saveBoxBtn.onclick = ()=>{
  const data = {
    id: editingBoxId || uid(),
    title: boxTitle.value || "(untitled)",
    status: boxStatus.value,
    buyin: boxBuyin.value,
    time: boxTime.value,
    extraLabel: boxExtraLabel.value,
    extraValue: boxExtraValue.value,
  };

  if(editingBoxId){
    state.boxes = state.boxes.map(b=>b.id===editingBoxId?data:b);
  } else {
    state.boxes.push(data);
  }

  saveState();
  closeBoxModal();
  render();
};

/* 카드 클릭 → layout 이동 (단일 핸들러) */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;

  const boxId = card.dataset.id;
  if (!boxId) return;

  const loader = document.getElementById("layoutLoading");
  if (loader) loader.classList.remove("hidden");

  requestAnimationFrame(() => {
    window.location.href = `layout_index.html?boxId=${boxId}`;
  });
});

/* ===============================
   KEYBOARD
   =============================== */
document.addEventListener("keydown",(e)=>{
  if(isTyping(document.activeElement)) return;
  const k = e.key.toLowerCase();

  if(k==="escape"){ closeBoxModal(); closeTextModal(); }
  if(k==="e") openTextModal();
  if(k==="w") openBoxModal(null);
});

/* ===============================
   BOOTSTRAP
   =============================== */
subscribeState();
loadState();
render();
