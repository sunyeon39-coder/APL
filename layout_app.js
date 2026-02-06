console.log("🔥 layout_app.js STABLE – CLEAN PARSE");

/* =================================================
   CLICK SAFE RESTORE (문법 안전)
   ================================================= */
(function () {
  try {
    document.documentElement.classList.remove("page-enter");
    document.documentElement.classList.add("page-ready");
    document.body.style.pointerEvents = "auto";

    const blockers = document.querySelectorAll(
      ".overlay, .loading, .blocker, .page-block, .modal-block, .layout-loading"
    );

    blockers.forEach(el => {
      const cs = getComputedStyle(el);
      const hidden =
        el.classList.contains("hidden") ||
        el.getAttribute("aria-hidden") === "true" ||
        cs.display === "none" ||
        cs.visibility === "hidden";

      if (hidden) el.style.pointerEvents = "none";
    });

    const top = document.querySelector(".layout-top");
    if (top) top.style.pointerEvents = "auto";
  } catch (e) {
    console.warn("click-safe skipped", e);
  }
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
   STATE
   ================================================= */
const STATE_REF = doc(db, "boxboard", "state");

const layout = {
  seats: {},
  waiting: []
};

let currentUserRole = "user";
let selectedWaitingIndex = null;
let isSaving = false;
let hasHydrated = false;
let unsubscribeLayout = null;

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

  const snap = await getDoc(doc(db, "users", user.uid));
  currentUserRole = snap.exists() ? snap.data().role || "user" : "user";

  applyRoleUI();
  subscribeLayout();
});

/* =================================================
   ROLE UI
   ================================================= */
function applyRoleUI() {
  if (currentUserRole === "admin") return;

  const addSeatBtn = $("addSeatBtn");
  if (addSeatBtn) addSeatBtn.remove();

  const input = $("waitingNameInput");
  if (input) {
    const wrap = input.closest(".waiting-header");
    if (wrap) wrap.remove();
  }

  const addWaitingBtn = $("addWaitingBtn");
  if (addWaitingBtn) addWaitingBtn.remove();
}

/* =================================================
   FIRESTORE
   ================================================= */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId || unsubscribeLayout) return;

  unsubscribeLayout = onSnapshot(STATE_REF, snap => {
    if (!snap.exists() || isSaving) return;

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box) return;

    const serverLayout = box.layout || { seats: {}, waiting: [] };

    if (!hasHydrated) {
      layout.seats = structuredClone(serverLayout.seats || {});
      layout.waiting = structuredClone(serverLayout.waiting || []);
      hasHydrated = true;
      renderLayout();
      renderWaitList();
      return;
    }

    if (
      JSON.stringify(layout.seats) !== JSON.stringify(serverLayout.seats) ||
      JSON.stringify(layout.waiting) !== JSON.stringify(serverLayout.waiting)
    ) {
      layout.seats = structuredClone(serverLayout.seats || {});
      layout.waiting = structuredClone(serverLayout.waiting || []);
      renderLayout();
      renderWaitList();
    }
  });
}

/* =================================================
   RENDER – SEATS
   ================================================= */
function renderLayout() {
  const grid = $("layoutGrid");
  if (!grid) return;

  grid.innerHTML = "";

  Object.keys(layout.seats)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(num => {
      const data = layout.seats[num];
      const el = document.createElement("section");
      el.className = "card";
      el.dataset.seat = num;

      el.innerHTML = `
        ${currentUserRole === "admin"
          ? `<button class="seat-delete" data-seat="${num}">×</button>`
          : ""}
        <div class="badge">Seat ${num}</div>
        <h3>${data ? data.name : "비어있음"}</h3>
        ${data
          ? `<div class="pill running">
               <span class="time" data-start="${data.startedAt}">0:00</span>
             </div>`
          : ""}
      `;
      grid.appendChild(el);
    });
}

/* =================================================
   RENDER – WAITING
   ================================================= */
function renderWaitList() {
  const list = $("waitingList");
  if (!list) return;

  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  layout.waiting.forEach((w, i) => {
    const el = document.createElement("section");
    el.className = "waiting-card card";
    el.dataset.waitingIndex = i;

    if (i === selectedWaitingIndex) el.classList.add("selected");

    el.innerHTML = `
      ${currentUserRole === "admin"
        ? `<button class="wait-delete" data-index="${i}">×</button>`
        : ""}
      <h3>${w.name}</h3>
      <div class="pill waiting">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
    `;
    list.appendChild(el);
  });
}

/* =================================================
   CLICK HANDLER
   ================================================= */
document.addEventListener("click", e => {
  const waitDel = e.target.closest(".wait-delete");
  if (waitDel && currentUserRole === "admin") {
    layout.waiting.splice(Number(waitDel.dataset.index), 1);
    selectedWaitingIndex = null;
    renderWaitList();
    saveLayout();
    return;
  }

  const seatDel = e.target.closest(".seat-delete");
  if (seatDel && currentUserRole === "admin") {
    const seatNum = Number(seatDel.dataset.seat);
    const person = layout.seats[seatNum];
    if (person) {
      layout.waiting.push({ name: person.name, startedAt: Date.now() });
    }
    delete layout.seats[seatNum];
    renderLayout();
    renderWaitList();
    saveLayout();
    return;
  }

  const waitingCard = e.target.closest(".waiting-card");
  if (waitingCard && currentUserRole === "admin") {
    selectedWaitingIndex = Number(waitingCard.dataset.waitingIndex);
    renderWaitList();
    return;
  }

  const seatCard = e.target.closest(".card");
  if (!seatCard || currentUserRole !== "admin") return;

  const seatNum = Number(seatCard.dataset.seat);
  if (!seatNum || selectedWaitingIndex === null) return;

  const incoming = layout.waiting[selectedWaitingIndex];
  const existing = layout.seats[seatNum];

  if (existing) {
    layout.waiting.push({ name: existing.name, startedAt: Date.now() });
  }

  layout.seats[seatNum] = { name: incoming.name, startedAt: Date.now() };
  layout.waiting.splice(selectedWaitingIndex, 1);
  selectedWaitingIndex = null;

  renderLayout();
  renderWaitList();
  saveLayout();
});

/* =================================================
   ADD WAITING
   ================================================= */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const input = $("waitingNameInput");
  if (!input || document.activeElement !== input) return;

  const name = input.value.trim();
  if (!name) return;

  layout.waiting.push({ name, startedAt: Date.now() });
  input.value = "";
  renderWaitList();
  saveLayout();
});

/* =================================================
   SAVE
   ================================================= */
function saveLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  isSaving = true;

  getDoc(STATE_REF)
    .then(snap => {
      if (!snap.exists()) return;
      const boxes = snap.data().boxes || [];
      const idx = boxes.findIndex(b => b.id === boxId);
      if (idx === -1) return;

      boxes[idx] = {
        ...boxes[idx],
        layout: { seats: layout.seats, waiting: layout.waiting }
      };
      return setDoc(STATE_REF, { boxes }, { merge: true });
    })
    .finally(() => {
      setTimeout(() => (isSaving = false), 100);
    });
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
  if (unsubscribeLayout) unsubscribeLayout();
});
