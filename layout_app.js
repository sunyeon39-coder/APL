console.log("🔥 REAL layout_app.js LOADED");

/* =================================================
   BoxBoard Layout App – FINAL STABLE (SYNCED + SAFE)
   - Firestore: boxboard/state 안 boxes[].layout 에 저장
   - Local: 즉시 반영(실패해도 UI 유지)
   ================================================= */

import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONST
   =============================== */
const STATE_REF = doc(db, "boxboard", "state");

/* ===============================
   FLAGS
   =============================== */
let isApplyingRemoteLayout = false;

/* ===============================
   TIMER UTIL
   =============================== */
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ===============================
   GLOBAL STATE
   =============================== */
let selectedSeat = null;
let selectedWaiting = null;

const layout = {
  seats: {},   // { "1": {id,name,startedAt} | null, ... }  / 존재하는 seat key만 표시
  waiting: []  // [{id,name,startedAt}, ...]
};

/* ===============================
   UTIL
   =============================== */
function getBoxId() {
  return new URLSearchParams(location.search).get("boxId");
}

function mustEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`필수 DOM 요소 없음: #${id}`);
  return el;
}

/* ===============================
   LOCAL STORAGE (box별 분리 저장)
   =============================== */
function lsKey() {
  const boxId = getBoxId() || "no_box";
  return `boxboard_layout_state_${boxId}`;
}

function saveLocal() {
  localStorage.setItem(lsKey(), JSON.stringify(layout));
}

function loadLocal() {
  const raw = localStorage.getItem(lsKey());
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    layout.seats = saved.seats || {};
    layout.waiting = saved.waiting || [];
    return true;
  } catch {
    return false;
  }
}

/* ===============================
   UI 즉시 반영(핵심)
   =============================== */
function applyLocalNext(next) {
  if (next.seats) layout.seats = next.seats;
  if (next.waiting) layout.waiting = next.waiting;
  saveLocal();
  renderLayout();
  renderWaitList();
}

/* ===============================
   FIRESTORE WRITE (boxes[].layout에 저장)
   - 실패해도 UI는 이미 반영되어 있음
   =============================== */
async function writeLayout(next) {
  if (isApplyingRemoteLayout) return;

  const boxId = getBoxId();
  if (!boxId) return;

  // 1) UI 먼저 반영 (실패해도 화면 유지)
  const optimistic = {
    seats: next.seats ?? layout.seats,
    waiting: next.waiting ?? layout.waiting
  };
  applyLocalNext(optimistic);

  // 2) Firestore 동기화
  try {
    const snap = await getDoc(STATE_REF);
    if (!snap.exists()) return;

    const data = snap.data();
    const prevBoxes = Array.isArray(data.boxes) ? data.boxes : [];

    const boxes = prevBoxes.map(b => {
      if (b.id !== boxId) return b;
      const prevLayout = b.layout || {};
      return {
        ...b,
        layout: {
          ...prevLayout,
          ...(next.seats ? { seats: next.seats } : null),
          ...(next.waiting ? { waiting: next.waiting } : null)
        }
      };
    });

    await setDoc(STATE_REF, { boxes }, { merge: true });
  } catch (e) {
    console.warn("⚠️ Firestore sync failed (UI kept):", e);
    // UI는 이미 반영되어 있으니 여기서 끝
  }
}

/* ===============================
   SUBSCRIBE (실시간 반영)
   =============================== */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  onSnapshot(STATE_REF, (snap) => {
    if (!snap.exists()) return;

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box) return;

    isApplyingRemoteLayout = true;

    layout.seats = box.layout?.seats || {};
    layout.waiting = box.layout?.waiting || [];
    saveLocal();
    renderLayout();
    renderWaitList();

    isApplyingRemoteLayout = false;
  });
}

/* ===============================
   ACTIONS
   =============================== */
async function addWaiting() {
  const input = mustEl("waitingNameInput");
  const name = (input.value || "").trim();
  if (!name) return;

  const nextWaiting = [
    ...layout.waiting,
    { id: "w_" + Date.now(), name, startedAt: Date.now() }
  ];

  input.value = "";
  selectedWaiting = null;

  await writeLayout({ waiting: nextWaiting });
}

async function tryAssign() {
  if (!selectedSeat || !selectedWaiting) return;

  const seatKey = String(selectedSeat.seatIndex);
  const nextSeats = { ...layout.seats };
  const nextWaiting = layout.waiting.filter(w => w.id !== selectedWaiting.id);

  // 이미 사람이 앉아 있으면 그 사람을 대기자로 밀어내기
  if (nextSeats[seatKey]) {
    nextWaiting.push({ ...nextSeats[seatKey], startedAt: Date.now() });
  }

  // 선택된 대기자를 seat에 앉힘
  nextSeats[seatKey] = { ...selectedWaiting, startedAt: Date.now() };

  selectedSeat = null;
  selectedWaiting = null;

  await writeLayout({ seats: nextSeats, waiting: nextWaiting });
}

/* ===============================
   RENDER: SEATS
   =============================== */
function renderLayout() {
  const grid = mustEl("layoutGrid");
  grid.innerHTML = "";

  const keys = Object.keys(layout.seats).sort((a, b) => Number(a) - Number(b));

  keys.forEach((k) => {
    const d = layout.seats[k]; // null 또는 사람 객체

    const seat = document.createElement("section");
    seat.className = "card";

    // 선택 표시(옵션)
    if (selectedSeat?.seatIndex === k) seat.classList.add("selected");

    seat.innerHTML = `
      <div class="badge">Seat ${k}</div>
      <button class="seat-delete" type="button" aria-label="delete">×</button>
      <h3>${d ? d.name : "비어있음"}</h3>
      ${
        d
          ? `<div class="pill running"><span class="time" data-start="${d.startedAt}">0:00</span></div>`
          : ""
      }
    `;

    // 단일 클릭: seat 선택 + 대기자 선택되어 있으면 배정
    let t = null;
    seat.addEventListener("click", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        selectedSeat = { seatIndex: k };
        if (selectedWaiting) tryAssign();
        renderLayout();
        renderWaitList();
      }, 120);
    });

    // 더블클릭: seat에 사람 있으면 대기자로 빼기(너 요구)
    seat.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (!layout.seats[k]) return;

      const p = layout.seats[k];
      const nextSeats = { ...layout.seats, [k]: null };
      const nextWaiting = [...layout.waiting, { ...p, startedAt: Date.now() }];

      writeLayout({ seats: nextSeats, waiting: nextWaiting });
    });

    // 삭제 버튼: seat 자체 제거
    seat.querySelector(".seat-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      const nextSeats = { ...layout.seats };
      delete nextSeats[k];

      // 선택 상태 정리
      if (selectedSeat?.seatIndex === k) selectedSeat = null;

      writeLayout({ seats: nextSeats });
    });

    grid.appendChild(seat);
  });
}

/* ===============================
   RENDER: WAITING
   =============================== */
function renderWaitList() {
  const list = mustEl("waitingList");
  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  layout.waiting.forEach((w) => {
    const card = document.createElement("section");
    card.className = "card waiting-card";

    if (selectedWaiting?.id === w.id) card.classList.add("selected");

    card.innerHTML = `
      <h3>${w.name}</h3>
      <div class="pill waiting">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
      <button class="wait-delete" type="button" aria-label="delete">×</button>
    `;

    // 클릭: 대기자 선택
    card.addEventListener("click", () => {
      selectedWaiting = w;
      if (selectedSeat) tryAssign();
      renderLayout();
      renderWaitList();
    });

    // 삭제
    card.querySelector(".wait-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      const nextWaiting = layout.waiting.filter(x => x.id !== w.id);
      if (selectedWaiting?.id === w.id) selectedWaiting = null;
      writeLayout({ waiting: nextWaiting });
    });

    list.appendChild(card);
  });
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1) 로컬 먼저
  loadLocal();
  renderLayout();
  renderWaitList();

  // 2) 구독 시작
  subscribeLayout();

  // 3) Seat 추가 버튼
  mustEl("addSeatBtn").addEventListener("click", async () => {
    const input = prompt("Seat 번호 입력");
    if (input === null) return;

    const n = Number(String(input).trim());
    if (!Number.isInteger(n) || n <= 0) {
      alert("올바른 번호를 입력하세요");
      return;
    }

    const key = String(n);
    if (Object.prototype.hasOwnProperty.call(layout.seats, key)) {
      alert("이미 존재하는 Seat 번호입니다");
      return;
    }

    const nextSeats = { ...layout.seats, [key]: null };
    await writeLayout({ seats: nextSeats });
  });

  // 4) 대기자 추가 버튼
  mustEl("addWaitingBtn").addEventListener("click", addWaiting);

  // Enter로도 추가(IME 대응)
  const waitingInput = mustEl("waitingNameInput");
  let composing = false;
  waitingInput.addEventListener("compositionstart", () => (composing = true));
  waitingInput.addEventListener("compositionend", () => (composing = false));
  waitingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !composing) {
      e.preventDefault();
      addWaiting();
    }
  });

  // 5) Back 버튼
  const backBtn = document.getElementById("layoutBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "index.html";
    });
  }
});

/* ===============================
   TIMER LOOP
   =============================== */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll(".time[data-start]").forEach((el) => {
    const start = Number(el.dataset.start);
    if (start) el.textContent = formatElapsed(now - start);
  });
}, 1000);
