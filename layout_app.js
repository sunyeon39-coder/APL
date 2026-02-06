console.log("🔥 layout_app.js FINAL – UI FIRST / FIRESTORE SYNC");


/* =================================================
   CLICK SAFE RESTORE (LAYOUT 버튼 클릭 안됨 방지)
   - UI/UX 변경 없이, '숨겨진 레이어가 클릭을 먹는' 케이스만 제거
   ================================================= */
(function(){
  try{
    document.documentElement.classList.remove("page-enter");
    document.documentElement.classList.add("page-ready");
    document.body.style.pointerEvents = "auto";

    // 숨김 처리된 overlay류는 클릭을 먹지 않게
    const blockers = document.querySelectorAll(".overlay, .loading, .blocker, .page-block, .modal-block, .layout-loading");
    blockers.forEach(el => {
      const isHidden =
        el.classList.contains("hidden") ||
        el.getAttribute("aria-hidden") === "true" ||
        getComputedStyle(el).display === "none" ||
        getComputedStyle(el).visibility === "hidden";
      if (isHidden) el.style.pointerEvents = "none";
    });

    // top bar는 항상 클릭 가능
    const top = document.querySelector(".layout-top");
    if (top) top.style.pointerEvents = "auto";
  }catch(e){}
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
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase.js";

/* =================================================
   CONST / STATE
   ================================================= */
const STATE_REF = doc(db, "boxboard", "state");

let currentUserRole = "user";

const layout = {
  seats: {},
  waiting: []
};

let selectedSeatNum = null;
let selectedWaitingIndex = null;
let isAddingWaiting = false;
let suppressClick = false;

/* UI ↔ Firestore 보호 */
let hasHydrated = false;
let isSaving = false;

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
    location.replace(new URL("login.html", location.href).href);
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

  $("addSeatBtn")?.remove();
  $("waitingNameInput")?.closest(".waiting-header")?.remove();
  $("addWaitingBtn")?.remove();
}

/* =================================================
   FIRESTORE SUBSCRIBE
   ================================================= */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  // 🔥 이미 구독 중이면 다시 안 건다
  if (unsubscribeLayout) {
    console.warn("⚠️ layout already subscribed");
    return;
  }

  onAuthStateChanged(auth, user => {
    if (!user) return;

    unsubscribeLayout = onSnapshot(
      STATE_REF,
      snap => {
        if (!snap.exists()) return;
        if (isSaving) return;

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
      },
      err => {
        // ❗ 여기서는 절대 redirect 금지
        console.warn("⚠️ layout listen error (ignored):", err.code);
      }
    );
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
      const seat = document.createElement("section");
      seat.className = "card";
      seat.dataset.seat = num;

      seat.innerHTML = `
        ${currentUserRole === "admin"
          ? `<button class="seat-delete" data-seat="${num}">×</button>`
          : ""}
        <div class="badge">Seat ${num}</div>
        <div class="seat-main">
          <h3>${data ? data.name : "비어있음"}</h3>
          ${
            data
              ? `<div class="pill running">
                   <span class="time" data-start="${data.startedAt}">0:00</span>
                 </div>`
              : ""
          }
        </div>
      `;
      grid.appendChild(seat);
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
    const card = document.createElement("section");
    card.className = "waiting-card card";
    card.dataset.waitingIndex = i;

    if (i === selectedWaitingIndex) card.classList.add("selected");

    card.innerHTML = `
      <button class="wait-delete" data-index="${i}">×</button>
      <h3>${w.name}</h3>
      <div class="pill waiting">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
    `;
    list.appendChild(card);
  });
}

/* =================================================
   CLICK HANDLER
   ================================================= */
document.addEventListener("click", e => {
  if (suppressClick) return;

  /* WAITING DELETE */
  const waitDel = e.target.closest(".wait-delete");
  if (waitDel && currentUserRole === "admin") {
    e.stopPropagation();
    layout.waiting.splice(Number(waitDel.dataset.index), 1);
    selectedWaitingIndex = null;
    renderWaitList();
    saveLayout();
    return;
  }

  /* SEAT DELETE (사람 → 대기 + Seat 삭제) */
  const seatDel = e.target.closest(".seat-delete");
  if (seatDel && currentUserRole === "admin") {
    e.stopPropagation();
    const seatNum = Number(seatDel.dataset.seat);
    const person = layout.seats[seatNum];
    if (person) {
      layout.waiting.push({ name: person.name, startedAt: Date.now() });
    }
    delete layout.seats[seatNum];
    selectedWaitingIndex = null;
    renderLayout();
    renderWaitList();
    saveLayout();
    return;
  }

  /* ADD SEAT */
  if (e.target.closest("#addSeatBtn")) {
    addSeat();
    return;
  }

  /* WAITING SELECT */
  const waitingCard = e.target.closest(".waiting-card");
  if (waitingCard && currentUserRole === "admin") {
    selectedWaitingIndex = Number(waitingCard.dataset.waitingIndex);
    renderWaitList();
    return;
  }

  /* WAITING → SEAT (교체 포함) */
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
   DOUBLE CLICK – Seat → Waiting
   ================================================= */
document.addEventListener("dblclick", e => {
  if (currentUserRole !== "admin") return;

  suppressClick = true;

  const seatCard = e.target.closest(".card");
  if (!seatCard || seatCard.classList.contains("waiting-card")) {
    suppressClick = false;
    return;
  }

  const seatNum = Number(seatCard.dataset.seat);
  const person = layout.seats[seatNum];
  if (!person) {
    suppressClick = false;
    return;
  }

  layout.waiting.push({ name: person.name, startedAt: Date.now() });
  layout.seats[seatNum] = null;
  selectedWaitingIndex = null;

  renderLayout();
  renderWaitList();
  saveLayout();

  setTimeout(() => (suppressClick = false), 0);
});

/* =================================================
   ADD WAITING
   ================================================= */
function addWaiting(name) {
  if (!name || isAddingWaiting) return;
  isAddingWaiting = true;
  layout.waiting.push({ name, startedAt: Date.now() });
  renderWaitList();
  saveLayout();
  setTimeout(() => (isAddingWaiting = false), 0);
}

document.addEventListener("keydown", e => {
  const input = e.target.closest("#waitingNameInput");
  if (!input || e.key !== "Enter") return;
  e.preventDefault();
  addWaiting(input.value.trim());
  input.value = "";
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
    .finally(() => setTimeout(() => (isSaving = false), 100));
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

/* ===============================
   🔥 CLEANUP (여기!)
=============================== */
window.addEventListener("beforeunload", () => {
  if (unsubscribeLayout) {
    unsubscribeLayout();
    unsubscribeLayout = null;
    console.log("🧹 layout listener cleaned up");
  }
});