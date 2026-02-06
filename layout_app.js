console.log("🔥 layout_app.js FINAL STABLE – SAFE & MOBILE READY");

/* =================================================
   CLICK SAFE INIT
================================================= */
(function () {
  try {
    document.documentElement.classList.remove("page-enter");
    document.documentElement.classList.add("page-ready");
    document.body.style.pointerEvents = "auto";

    document
      .querySelectorAll(".overlay,.loading,.layout-loading")
      .forEach(el => {
        if (el.classList.contains("hidden")) {
          el.style.pointerEvents = "none";
        }
      });

    document.querySelector(".layout-top")?.style.pointerEvents = "auto";
  } catch {}
})();

/* =================================================
   IMPORT
================================================= */
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

/* =================================================
   CONST / STATE
================================================= */
const STATE_REF = doc(db, "boxboard", "state");

const layout = {
  seats: {},      // { 1: {name, startedAt}, ... }
  waiting: []     // [{name, startedAt}]
};

let currentUserRole = "user";
let selectedWaitingIndex = null;
let hasHydrated = false;
let isSaving = false;
let unsubscribe = null;

const $ = id => document.getElementById(id);

/* =================================================
   UTIL
================================================= */
function getBoxId() {
  return new URLSearchParams(location.search).get("boxId");
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* =================================================
   AUTH / ROLE
================================================= */
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    currentUserRole = snap.exists() ? snap.data().role || "user" : "user";
  } catch {
    currentUserRole = "user";
  }

  applyRoleUI();
  subscribe();
});

/* =================================================
   ROLE UI
================================================= */
function applyRoleUI() {
  if (currentUserRole === "admin") return;

  $("addSeatBtn")?.remove();
  $("addWaitingBtn")?.remove();

  const input = $("waitingNameInput");
  input?.closest(".waiting-header")?.remove();
}

/* =================================================
   FIRESTORE SUBSCRIBE (SAFE)
================================================= */
function subscribe() {
  const boxId = getBoxId();
  if (!boxId || unsubscribe) return;

  unsubscribe = onSnapshot(
    STATE_REF,
    snap => {
      if (!snap.exists()) return;

      const data = snap.data();
      if (!data || !Array.isArray(data.boxes)) return;

      const box = data.boxes.find(b => b.id === boxId);
      if (!box) return;

      const server = box.layout || { seats: {}, waiting: [] };

      if (!hasHydrated) {
        layout.seats = structuredClone(server.seats || {});
        layout.waiting = structuredClone(server.waiting || []);
        hasHydrated = true;
        renderAll();
        return;
      }

      if (
        JSON.stringify(layout.seats) !== JSON.stringify(server.seats) ||
        JSON.stringify(layout.waiting) !== JSON.stringify(server.waiting)
      ) {
        layout.seats = structuredClone(server.seats || {});
        layout.waiting = structuredClone(server.waiting || []);
        renderAll();
      }
    },
    err => console.warn("⚠️ snapshot blocked:", err.code)
  );
}

/* =================================================
   RENDER
================================================= */
function renderAll() {
  renderSeats();
  renderWaiting();
}

function renderSeats() {
  const grid = $("layoutGrid");
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(layout.seats)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(num => {
      const p = layout.seats[num];
      const el = document.createElement("section");
      el.className = "card seat-card";
      el.dataset.seat = num;

      el.innerHTML = `
        ${currentUserRole === "admin"
          ? `<button class="seat-delete" data-seat="${num}">×</button>`
          : ""}
        <div class="badge">Seat ${num}</div>
        <h3>${p ? p.name : "비어있음"}</h3>
        ${p ? `<div class="pill"><span class="time" data-start="${p.startedAt}">0:00</span></div>` : ""}
      `;
      grid.appendChild(el);
    });
}

function renderWaiting() {
  const list = $("waitingList");
  if (!list) return;
  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  layout.waiting.forEach((w, i) => {
    const el = document.createElement("section");
    el.className = "card waiting-card";
    if (i === selectedWaitingIndex) el.classList.add("selected");
    el.dataset.index = i;

    el.innerHTML = `
      ${currentUserRole === "admin"
        ? `<button class="wait-delete" data-index="${i}">×</button>`
        : ""}
      <h3>${w.name}</h3>
      <div class="pill">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
    `;
    list.appendChild(el);
  });
}

/* =================================================
   CLICK HANDLING (MOBILE SAFE)
================================================= */
document.addEventListener("click", e => {
  if (currentUserRole !== "admin") return;

  // delete waiting
  const wdel = e.target.closest(".wait-delete");
  if (wdel) {
    layout.waiting.splice(Number(wdel.dataset.index), 1);
    selectedWaitingIndex = null;
    renderWaiting();
    save();
    return;
  }

  // delete seat
  const sdel = e.target.closest(".seat-delete");
  if (sdel) {
    const n = Number(sdel.dataset.seat);
    const p = layout.seats[n];
    if (p) layout.waiting.push({ name: p.name, startedAt: Date.now() });
    delete layout.seats[n];
    renderAll();
    save();
    return;
  }

  // select waiting
  const w = e.target.closest(".waiting-card");
  if (w) {
    selectedWaitingIndex = Number(w.dataset.index);
    renderWaiting();
    return;
  }

  // waiting → seat
  const s = e.target.closest(".seat-card");
  if (!s || selectedWaitingIndex === null) return;

  const seatNum = Number(s.dataset.seat);
  const incoming = layout.waiting[selectedWaitingIndex];
  const existing = layout.seats[seatNum];

  if (existing) {
    layout.waiting.push({ name: existing.name, startedAt: Date.now() });
  }

  layout.seats[seatNum] = { name: incoming.name, startedAt: Date.now() };
  layout.waiting.splice(selectedWaitingIndex, 1);
  selectedWaitingIndex = null;

  renderAll();
  save();
});

/* =================================================
   ADD WAITING
================================================= */
$("addWaitingBtn")?.addEventListener("click", () => {
  const input = $("waitingNameInput");
  if (!input?.value.trim()) return;
  layout.waiting.push({ name: input.value.trim(), startedAt: Date.now() });
  input.value = "";
  renderWaiting();
  save();
});

/* =================================================
   SAVE (SAFE)
================================================= */
function save() {
  if (isSaving) return;
  const boxId = getBoxId();
  if (!boxId) return;

  isSaving = true;

  getDoc(STATE_REF)
    .then(snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data || !Array.isArray(data.boxes)) return;

      const boxes = data.boxes;
      const idx = boxes.findIndex(b => b.id === boxId);
      if (idx === -1) return;

      boxes[idx] = {
        ...boxes[idx],
        layout: { seats: layout.seats, waiting: layout.waiting }
      };

      return setDoc(STATE_REF, { boxes }, { merge: true });
    })
    .catch(err => console.warn("⚠️ save blocked:", err.code))
    .finally(() => setTimeout(() => (isSaving = false), 150));
}

/* =================================================
   TIMER
================================================= */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll(".time[data-start]").forEach(el => {
    el.textContent = formatElapsed(now - Number(el.dataset.start));
  });
}, 1000);

/* =================================================
   CLEANUP
================================================= */
window.addEventListener("beforeunload", () => {
  if (unsubscribe) unsubscribe();
});
