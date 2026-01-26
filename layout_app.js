console.log("🔥 layout_app.js FINAL SYNC LOADED");

/* =================================================
   BoxBoard Layout App – FINAL SYNC VERSION
   ================================================= */

import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONST
   =============================== */
const STATE_REF = doc(db, "boxboard", "state");
const LS_KEY = "boxboard_layout_state_v2";

/* ===============================
   FLAGS
   =============================== */
let hydrated = false;          // Firestore 최초 수신 여부
let isRemoteApplying = false; // 무한 루프 방지

/* ===============================
   STATE
   =============================== */
const layout = {
  seats: {},     // { [seatNumber]: { name, startedAt } | null }
  waiting: []    // [{ id, name, startedAt }]
};

/* ===============================
   UTIL
   =============================== */
const $ = id => document.getElementById(id);

function getBoxId() {
  return new URLSearchParams(location.search).get("boxId");
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now();
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ===============================
   LOCAL (fallback only)
   =============================== */
function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
}

function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    layout.seats = data.seats || {};
    layout.waiting = data.waiting || [];
    return true;
  } catch {
    return false;
  }
}

/* ===============================
   FIRESTORE SUBSCRIBE (🔥 핵심)
   =============================== */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  onSnapshot(STATE_REF, snap => {
    if (!snap.exists()) return;

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box) return;

    isRemoteApplying = true;
    hydrated = true;

    layout.seats = box.layout?.seats || {};
    layout.waiting = box.layout?.waiting || [];

    saveLocal();
    renderLayout();
    renderWaitList();

    isRemoteApplying = false;
  });
}

/* ===============================
   WRITE TO FIRESTORE
   =============================== */
async function writeLayout(next) {
  if (isRemoteApplying) return;

  const boxId = getBoxId();
  if (!boxId) return;

  const snap = await new Promise(res =>
    onSnapshot(STATE_REF, s => s.exists() && res(s), { once: true })
  );
  if (!snap) return;

  const data = snap.data();

  const boxes = (data.boxes || []).map(b =>
    b.id === boxId
      ? { ...b, layout: { ...(b.layout || {}), ...next } }
      : b
  );

  await setDoc(STATE_REF, { boxes }, { merge: true });

  Object.assign(layout, next);
  saveLocal();
}

/* ===============================
   RENDER – SEATS
   =============================== */
function renderLayout() {
  const grid = $("layoutGrid");
  grid.innerHTML = "";

  Object.keys(layout.seats)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(i => {
      const d = layout.seats[i];

      const seat = document.createElement("section");
      seat.className = "card";

      seat.innerHTML = `
        <div class="badge">Seat ${i}</div>
        <button class="seat-delete">×</button>
        <h3>${d ? d.name : "비어있음"}</h3>
        ${d ? `<div class="pill running">
          <span class="time" data-start="${d.startedAt}">0:00</span>
        </div>` : ""}
      `;

      // 단일 클릭: 선택
      seat.onclick = () => {
        if (!selectedWaiting) return;
        assignWaitingToSeat(i);
      };

      // 더블 클릭: Seat → Waiting
      seat.ondblclick = e => {
        e.preventDefault();
        if (!layout.seats[i]) return;

        const p = layout.seats[i];
        writeLayout({
          seats: { ...layout.seats, [i]: null },
          waiting: [...layout.waiting, { ...p, id: uid(), startedAt: Date.now() }]
        });
      };

      seat.querySelector(".seat-delete").onclick = e => {
        e.stopPropagation();
        const next = { ...layout.seats };
        delete next[i];
        writeLayout({ seats: next });
      };

      grid.appendChild(seat);
    });
}

/* ===============================
   RENDER – WAITING
   =============================== */
let selectedWaiting = null;

function renderWaitList() {
  const list = $("waitingList");
  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  layout.waiting.forEach(w => {
    const card = document.createElement("section");
    card.className = "waiting-card card";

    card.innerHTML = `
      <h3>${w.name}</h3>
      <div class="pill waiting">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
      <button class="wait-delete">×</button>
    `;

    card.onclick = () => selectedWaiting = w;

    card.querySelector(".wait-delete").onclick = e => {
      e.stopPropagation();
      writeLayout({
        waiting: layout.waiting.filter(x => x.id !== w.id)
      });
    };

    list.appendChild(card);
  });
}

/* ===============================
   ACTIONS
   =============================== */
function assignWaitingToSeat(seatIndex) {
  if (!selectedWaiting) return;

  writeLayout({
    seats: {
      ...layout.seats,
      [seatIndex]: { name: selectedWaiting.name, startedAt: Date.now() }
    },
    waiting: layout.waiting.filter(w => w.id !== selectedWaiting.id)
  });

  selectedWaiting = null;
}

function addWaiting() {
  const input = $("waitingNameInput");
  const name = input.value.trim();
  if (!name) return;

  writeLayout({
    waiting: [...layout.waiting, { id: uid(), name, startedAt: Date.now() }]
  });

  input.value = "";
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {
  // 🔥 Firestore 우선
  subscribeLayout();

  // fallback
  setTimeout(() => {
    if (!hydrated) {
      loadLocal();
      renderLayout();
      renderWaitList();
    }
  }, 500);

  $("addSeatBtn").onclick = async () => {
    const input = prompt("Seat 번호 입력");
    if (input === null) return;

    const n = Number(input.trim());
    if (!Number.isInteger(n) || n <= 0) {
      alert("올바른 번호를 입력하세요");
      return;
    }
    if (layout.seats[n]) {
      alert("이미 존재하는 Seat 입니다");
      return;
    }

    layout.seats = { ...layout.seats, [n]: null };
    saveLocal();
    renderLayout();

    try {
      await writeLayout({ seats: layout.seats });
    } catch (e) {
      console.warn("Seat sync 실패", e);
    }
  };

  $("addWaitingBtn").onclick = addWaiting;

  $("layoutBackBtn")?.addEventListener("click", () => {
    history.length > 1 ? history.back() : location.href = "index.html";
  });
});

/* ===============================
   TIMER LOOP
   =============================== */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll(".time[data-start]").forEach(el => {
    const start = Number(el.dataset.start);
    if (start) el.textContent = formatElapsed(now - start);
  });
}, 1000);
