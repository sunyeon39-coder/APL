console.log("🔥 REAL layout_app.js LOADED");

/* =================================================
   BoxBoard Layout App – FINAL STABLE (SYNCED)
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
const LS_KEY = "boxboard_layout_state";

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
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

/* ===============================
   GLOBAL STATE
   =============================== */
let selectedSeat = null;
let selectedWaiting = null;

const layout = {
  seats: {},
  waiting: []
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
   LOCAL STORAGE
   =============================== */
function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
}
function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
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
   WRITE LAYOUT (SAFE)
   =============================== */
async function writeLayout(next) {
  if (isApplyingRemoteLayout) return;

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
   SUBSCRIBE
   =============================== */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  onSnapshot(STATE_REF, snap => {
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
   RENDER (기존 로직 그대로)
   =============================== */
function renderLayout() {
  const grid = mustEl("layoutGrid");
  grid.innerHTML = "";

  Object.keys(layout.seats).sort((a,b)=>a-b).forEach(i => {
    const d = layout.seats[i];
    const seat = document.createElement("section");
    seat.className = "card";

    seat.innerHTML = `
      <div class="badge">Seat ${i}</div>
      <button class="seat-delete">×</button>
      <h3>${d ? d.name : "비어있음"}</h3>
      ${d ? `<div class="pill running"><span class="time" data-start="${d.startedAt}">0:00</span></div>` : ""}
    `;

    let timer = null;
    seat.onclick = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        selectedSeat = { seatIndex: i };
        if (selectedWaiting) tryAssign();
      }, 180);
    };

    seat.ondblclick = e => {
      e.preventDefault();
      if (!layout.seats[i]) return;
      const p = layout.seats[i];
      writeLayout({
        seats: { ...layout.seats, [i]: null },
        waiting: [...layout.waiting, { ...p, startedAt: Date.now() }]
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

function renderWaitList() {
  const list = mustEl("waitingList");
  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  layout.waiting.forEach(w => {
    const card = document.createElement("section");
    card.className = "card waiting-card";
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
      writeLayout({ waiting: layout.waiting.filter(x => x.id !== w.id) });
    };

    list.appendChild(card);
  });
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {
  loadLocal();
  renderLayout();
  renderWaitList();
  subscribeLayout();

  mustEl("addSeatBtn").onclick = () => {
    const n = Number(prompt("Seat 번호 입력"));
    if (!Number.isInteger(n) || n <= 0 || layout.seats[n]) return;
    writeLayout({ seats: { ...layout.seats, [n]: null } });
  };

  mustEl("addWaitingBtn").onclick = addWaiting;

  const backBtn = document.getElementById("layoutBackBtn");
  if (backBtn) {
    backBtn.onclick = () => history.length > 1 ? history.back() : location.href = "index.html";
  }
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
