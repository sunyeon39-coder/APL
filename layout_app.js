// layout_app.js — Firestore + Role + Timer + Shortcuts (Dealer-use v2)
// 요구사항 반영:
// - Empty 텍스트 제거
// - Seat 라벨을 prompt로 직접 입력
// - Waiting #n 제거
// - Waiting은 세로 스크롤
// - Seat 고정(슬롯 객체 유지) + 사람만 이동/스왑
//
// ⚠️ 같은 폴더에 firebase.js 필요:
// export const db, auth;

import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM
=============================== */
const seatGrid = document.getElementById("seatGrid");
const waitingGrid = document.getElementById("waitingGrid");
const addSeatBtn = document.getElementById("addSeatBtn");
const addWaitingBtn = document.getElementById("addWaitingBtn");
const waitingInput = document.getElementById("waitingInput");

/* ===============================
   STATE
=============================== */
const boxId = new URLSearchParams(location.search).get("boxId") || "default";
const DOC_REF = doc(db, "boxboard_layouts", boxId);
const LS_KEY = `boxboard_layout_${boxId}_v2`;

let currentUser = null;
let currentUserRole = "user"; // admin | user

// Seat는 '고정 슬롯' 객체. (배열 순서가 곧 레이아웃)
let state = {
  seats: [],   // [{id: "A", name: null|"홍길동", start: number|null}]
  waiting: []  // [{id: "w_xxx", name: "홍길동", start: number}]
};

let selectedSeatId = null;     // string seat.id
let selectedWaitingId = null;  // string waiting.id

// Firestore 보호
let hasHydrated = false;
let isSaving = false;

const uid = () => "w_" + Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

/* ===============================
   TIME
=============================== */
function formatElapsed(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/* ===============================
   ROLE
=============================== */
function applyRoleUI(){
  const isAdmin = currentUserRole === "admin";
  addSeatBtn.disabled = !isAdmin;
  addWaitingBtn.disabled = !isAdmin;
  waitingInput.disabled = !isAdmin;
}

/* ===============================
   STORAGE (LOCAL CACHE)
=============================== */
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || typeof data !== "object") return false;
    if(Array.isArray(data.seats)) state.seats = data.seats;
    if(Array.isArray(data.waiting)) state.waiting = data.waiting;
    return true;
  }catch(e){
    return false;
  }
}
function saveLocal(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      seats: state.seats,
      waiting: state.waiting
    }));
  }catch(e){}
}

/* ===============================
   FIRESTORE SYNC
=============================== */
async function saveRemote(){
  if(currentUserRole !== "admin") return;
  isSaving = true;
  try{
    await setDoc(DOC_REF, {
      seats: state.seats,
      waiting: state.waiting,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }finally{
    // snapshot이 올 때까지 잠깐 딜레이 주면 루프가 더 줄어듦
    setTimeout(() => { isSaving = false; }, 150);
  }
}

function saveAndRender(){
  saveLocal();
  render(); // 즉시 UI 반영
  // 원격은 admin만
  saveRemote();
}

/* ===============================
   MUTATIONS (Dealer-safe)
=============================== */
function getSeatById(id){
  return state.seats.find(s => String(s.id) === String(id)) || null;
}
function getWaitingById(id){
  return state.waiting.find(w => w.id === id) || null;
}

function assignWaitingToSeat(waitingId, seatId){
  const seat = getSeatById(seatId);
  const wIdx = state.waiting.findIndex(w => w.id === waitingId);
  if(!seat || wIdx < 0) return;

  const w = state.waiting[wIdx];

  // seat가 비어있으면 배정
  if(!seat.name){
    seat.name = w.name;
    seat.start = w.start;
    state.waiting.splice(wIdx, 1);
    selectedSeatId = null;
    selectedWaitingId = null;
    saveAndRender();
    return;
  }

  // seat가 차있으면 스왑(사람만 교체)
  // seat 사람이 waiting으로 내려가고, waiting 사람이 seat로 올라감
  const oldName = seat.name;
  const oldStart = seat.start;

  seat.name = w.name;
  seat.start = w.start;

  state.waiting[wIdx] = {
    id: w.id,
    name: oldName,
    start: oldStart || now()
  };

  selectedSeatId = null;
  selectedWaitingId = null;
  saveAndRender();
}

function moveSeatPersonToWaiting(seatId){
  const seat = getSeatById(seatId);
  if(!seat || !seat.name) return;

  state.waiting.unshift({
    id: uid(),
    name: seat.name,
    start: seat.start || now()
  });

  seat.name = null;
  seat.start = null;

  selectedSeatId = null;
  selectedWaitingId = null;
  saveAndRender();
}

function deleteWaiting(waitingId){
  const idx = state.waiting.findIndex(w => w.id === waitingId);
  if(idx < 0) return;
  state.waiting.splice(idx, 1);
  selectedWaitingId = null;
  saveAndRender();
}

function deleteSeatSlot(seatId){
  // 슬롯 삭제는 '마지막 슬롯만' 권장(사고 방지). 그래도 원하면 바로 삭제.
  const idx = state.seats.findIndex(s => String(s.id) === String(seatId));
  if(idx < 0) return;

  // 삭제하려는 seat에 사람이 있으면 먼저 waiting으로 이동
  const seat = state.seats[idx];
  if(seat.name){
    state.waiting.unshift({
      id: uid(),
      name: seat.name,
      start: seat.start || now()
    });
  }

  state.seats.splice(idx, 1);
  selectedSeatId = null;
  saveAndRender();
}

function renameSelected(){
  if(currentUserRole !== "admin") return;

  if(selectedSeatId){
    const seat = getSeatById(selectedSeatId);
    if(!seat) return;
    const cur = seat.name || "";
    const next = prompt("Seat 이름 변경", cur);
    if(next === null) return;
    seat.name = next.trim() ? next.trim() : null;
    if(seat.name && !seat.start) seat.start = now();
    if(!seat.name) seat.start = null;
    saveAndRender();
    return;
  }

  if(selectedWaitingId){
    const w = getWaitingById(selectedWaitingId);
    if(!w) return;
    const next = prompt("대기자 이름 변경", w.name);
    if(next === null) return;
    w.name = next.trim() || w.name;
    saveAndRender();
  }
}

/* ===============================
   RENDER
=============================== */
function el(tag, cls){
  const node = document.createElement(tag);
  if(cls) node.className = cls;
  return node;
}

function render(){
  seatGrid.innerHTML = "";
  waitingGrid.innerHTML = "";

  // SEATS
  const seatFrag = document.createDocumentFragment();
  for(const seat of state.seats){
    const card = el("div", "seat-card" + (selectedSeatId === String(seat.id) ? " selected" : ""));
    card.dataset.seatId = String(seat.id);

    card.addEventListener("click", () => {
      selectedSeatId = String(seat.id);
      // waiting이 선택된 상태면(=스왑/배정 모드) seat 클릭으로 처리
      if(selectedWaitingId && currentUserRole === "admin"){
        assignWaitingToSeat(selectedWaitingId, selectedSeatId);
        return;
      }
      selectedWaitingId = null;
      render();
    });

    card.addEventListener("dblclick", () => {
      if(currentUserRole !== "admin") return;
      // 더블클릭: seat -> waiting (사람만 이동)
      moveSeatPersonToWaiting(String(seat.id));
    });

    const del = el("button", "delete-btn");
    del.textContent = "×";
    del.title = "Seat 슬롯 삭제";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if(currentUserRole !== "admin") return;
      deleteSeatSlot(String(seat.id));
    });

    const label = el("div", "seat-label");
    label.textContent = `Seat ${seat.id}`;

    const name = el("div", "seat-name");
    // ✅ Empty 텍스트 제거 (빈칸 유지)
    name.textContent = seat.name ?? "";

    const time = el("div", "seat-time");
    time.textContent = seat.start ? formatElapsed(now() - seat.start) : "";

    card.appendChild(label);
    card.appendChild(name);
    card.appendChild(time);
    if(currentUserRole === "admin") card.appendChild(del);
    seatFrag.appendChild(card);
  }
  seatGrid.appendChild(seatFrag);

  // WAITING (번호 제거: 이름/시간만)
  const waitFrag = document.createDocumentFragment();
  for(const w of state.waiting){
    const card = el("div", "waiting-card" + (selectedWaitingId === w.id ? " selected" : ""));
    card.dataset.waitId = w.id;

    card.addEventListener("click", () => {
      if(currentUserRole !== "admin"){
        // user는 선택만
        selectedWaitingId = w.id;
        selectedSeatId = null;
        render();
        return;
      }

      // admin: seat이 선택돼 있으면 배정(또는 스왑)
      if(selectedSeatId){
        assignWaitingToSeat(w.id, selectedSeatId);
        return;
      }

      selectedWaitingId = w.id;
      selectedSeatId = null;
      render();
    });

    const name = el("div", "waiting-name");
    name.textContent = w.name;

    const time = el("div", "waiting-time");
    time.textContent = formatElapsed(now() - w.start);

    const del = el("button", "delete-btn");
    del.textContent = "×";
    del.title = "대기자 삭제";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if(currentUserRole !== "admin") return;
      deleteWaiting(w.id);
    });

    card.appendChild(name);
    card.appendChild(time);
    if(currentUserRole === "admin") card.appendChild(del);
    waitFrag.appendChild(card);
  }
  waitingGrid.appendChild(waitFrag);

  applyRoleUI();
}

/* ===============================
   EVENTS
=============================== */
addSeatBtn.addEventListener("click", () => {
  if(currentUserRole !== "admin") return;

  const label = prompt("Seat 라벨 입력 (예: 1, A, BTN)");
  if(label === null) return;
  const id = label.trim();
  if(!id) return;

  // 중복 방지
  if(state.seats.some(s => String(s.id).toLowerCase() === id.toLowerCase())){
    alert("이미 존재하는 Seat 라벨입니다.");
    return;
  }

  state.seats.push({ id, name: null, start: null });
  saveAndRender();
});

addWaitingBtn.addEventListener("click", () => {
  if(currentUserRole !== "admin") return;

  const name = (waitingInput.value || "").trim();
  if(!name) return;

  state.waiting.unshift({ id: uid(), name, start: now() });
  waitingInput.value = "";
  saveAndRender();
});

waitingInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){
    e.preventDefault();
    addWaitingBtn.click();
  }
});

/* ===============================
   SHORTCUTS
=============================== */
function isTypingTarget(){
  const el = document.activeElement;
  return el && ["INPUT","TEXTAREA","SELECT"].includes(el.tagName);
}

window.addEventListener("keydown", (e) => {
  if(isTypingTarget()) {
    if(e.key === "Escape"){
      e.preventDefault();
      document.activeElement.blur();
    }
    return;
  }

  // Esc: 선택 해제
  if(e.key === "Escape"){
    selectedSeatId = null;
    selectedWaitingId = null;
    render();
    return;
  }

  if(currentUserRole !== "admin") return;

  // W: 대기 입력 포커스
  if(e.key.toLowerCase() === "w"){
    e.preventDefault();
    waitingInput.focus();
    return;
  }

  // A: Seat 추가
  if(e.key.toLowerCase() === "a"){
    e.preventDefault();
    addSeatBtn.click();
    return;
  }

  // E: 이름 변경
  if(e.key.toLowerCase() === "e"){
    e.preventDefault();
    renameSelected();
    return;
  }

  // Delete/Backspace: 선택 삭제/내보내기
  if(e.key === "Delete" || e.key === "Backspace"){
    e.preventDefault();
    if(selectedWaitingId){
      deleteWaiting(selectedWaitingId);
      return;
    }
    if(selectedSeatId){
      const seat = getSeatById(selectedSeatId);
      if(!seat) return;
      // 사람이 있으면 waiting으로 내보내기, 비어있으면 슬롯 삭제
      if(seat.name) moveSeatPersonToWaiting(selectedSeatId);
      else deleteSeatSlot(selectedSeatId);
      return;
    }
  }

  // Ctrl/Cmd+S: 강제 저장
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
    e.preventDefault();
    saveRemote();
  }
});

/* ===============================
   BOOT
=============================== */
function ensureDefaultSeats(){
  if(state.seats.length > 0) return;
  // 기본 좌석 4개(라벨만). 필요 없으면 바로 삭제해도 됨.
  state.seats = [
    { id: "1", name: null, start: null },
    { id: "2", name: null, start: null },
    { id: "3", name: null, start: null },
    { id: "4", name: null, start: null },
  ];
}

async function loadUserRole(uid){
  try{
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const role = snap.data()?.role;
      if(role === "admin" || role === "user") return role;
    }
  }catch(e){}
  return "user";
}

// 1) 로컬 먼저 띄우고
loadLocal();
ensureDefaultSeats();
render();

// 2) Auth → Role
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  currentUserRole = user ? await loadUserRole(user.uid) : "user";
  applyRoleUI();
  render();
});

// 3) Firestore subscribe
onSnapshot(DOC_REF, (snap) => {
  if(!snap.exists()){
    // 최초 문서 없으면 admin이면 올려서 생성
    hasHydrated = true;
    saveLocal();
    return;
  }

  if(isSaving) return;

  const data = snap.data() || {};
  if(Array.isArray(data.seats)) state.seats = data.seats;
  if(Array.isArray(data.waiting)) state.waiting = data.waiting;

  hasHydrated = true;
  saveLocal();
  render();
});

// 4) 타이머 업데이트(가볍게 렌더 재호출)
setInterval(() => {
  // 타이머 텍스트만 갱신하려면 더 최적화 가능하지만,
  // 현재 규모(수십명)에서는 전체 render도 충분히 안정적.
  render();
}, 1000);
