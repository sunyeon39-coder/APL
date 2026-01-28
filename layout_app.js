console.log("🔥 layout_app.js FINAL – UI FIRST / FIRESTORE SYNC");

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


/* 🔥 UI ↔ Firestore 분리용 */
let hasHydrated = false; // 최초 1회 서버 → 로컬
let isSaving = false;    // 로컬 저장 중

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
  currentUserRole = snap.exists()
    ? snap.data().role || "user"
    : "user";

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
   UI FIRST / SERVER FOLLOW
   ================================================= */
function subscribeLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  onSnapshot(STATE_REF, snap => {
    if (!snap.exists()) return;
    if (isSaving) return; // 🔥 로컬 UI 보호

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box) return;

    const serverLayout = box.layout || { seats: {}, waiting: [] };

    // 최초 1회만 서버 → 로컬
    if (!hasHydrated) {
      layout.seats = structuredClone(serverLayout.seats || {});
      layout.waiting = structuredClone(serverLayout.waiting || []);
      hasHydrated = true;
      renderLayout();
      renderWaitList();
      return;
    }

    // 이후엔 외부 변경만 반영
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
   ADD SEAT (ADMIN)
   ================================================= */
function addSeat() {
  if (currentUserRole !== "admin") return;

  const input = prompt("추가할 Seat 번호");
  const seatNum = Number(input);
  if (!Number.isInteger(seatNum) || seatNum <= 0) return;

  if (layout.seats.hasOwnProperty(seatNum)) return;

  layout.seats[seatNum] = null;
  renderLayout();
  saveLayout();
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

      if (num === selectedSeatNum) {
        seat.classList.add("seat-selected");
      }

      seat.innerHTML = `
        ${currentUserRole === "admin"
          ? `<button class="seat-delete" data-seat="${num}">×</button>`
          : ""
        }
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

    if (i === selectedWaitingIndex) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <button class="wait-delete" data-index="${i}" title="삭제">×</button>
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
   /* WAITING DELETE */
  const del = e.target.closest(".wait-delete");
  if (del && currentUserRole === "admin") {
    e.stopPropagation(); // 🔥 선택/배치 방지

    const idx = Number(del.dataset.index);
    if (!Number.isInteger(idx)) return;

    layout.waiting.splice(idx, 1);
    selectedWaitingIndex = null;

    renderWaitList();
    saveLayout();
    return;
  }
  /* SEAT FORCE EXIT → WAITING */
  const seatDel = e.target.closest(".seat-delete");
  if (seatDel && currentUserRole === "admin") {
    e.stopPropagation(); // 🔥 다른 클릭 로직 차단

    const seatNum = Number(seatDel.dataset.seat);
    if (!seatNum) return;

    const person = layout.seats[seatNum];
    if (!person) return;

    // Seat → Waiting (강제 퇴장)
    layout.waiting.push({
      name: person.name,
      startedAt: Date.now()
    });

    layout.seats[seatNum] = null;
    selectedSeatNum = null;
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

  /* SEAT DELETE */
  const delBtn = e.target.closest(".seat-delete");
  if (delBtn && currentUserRole === "admin") {
    const seatNum = Number(delBtn.dataset.seat);
    delete layout.seats[seatNum];
    renderLayout();
    saveLayout();
    return;
  }

  /* WAITING SELECT */
  const waitingCard = e.target.closest(".waiting-card");
  if (waitingCard && currentUserRole === "admin") {
    selectedWaitingIndex = Number(waitingCard.dataset.waitingIndex);
    renderWaitList();
    return;
  }

  /* WAITING → SEAT ONLY */
  const seatCard = e.target.closest(".card");
  if (!seatCard || currentUserRole !== "admin") return;

  const seatNum = Number(seatCard.dataset.seat); // ✅ 반드시 여기 있어야 함
  if (!seatNum) return;

  if (selectedWaitingIndex === null) return;

  if (layout.seats[seatNum]) return;

  const person = layout.waiting[selectedWaitingIndex];
  layout.seats[seatNum] = {
    name: person.name,
    startedAt: Date.now()
  };

  layout.waiting.splice(selectedWaitingIndex, 1);
  selectedWaitingIndex = null;

  renderLayout();
  renderWaitList();
  saveLayout();
});


/* =================================================
   🔥 DOUBLE CLICK → Seat → Waiting (핵심)
   ================================================= */
document.addEventListener("dblclick", e => {
  if (currentUserRole !== "admin") return;

  suppressClick = true; // 🔥 click 차단 시작

  const seatCard = e.target.closest(".card");
  if (!seatCard || seatCard.classList.contains("waiting-card")) {
    suppressClick = false;
    return;
  }

  const seatNum = Number(seatCard.dataset.seat);
  if (!seatNum) {
    suppressClick = false;
    return;
  }

  const person = layout.seats[seatNum];
  if (!person) {
    suppressClick = false;
    return;
  }

  // Seat → Waiting
  layout.waiting.push({
    name: person.name,
    startedAt: Date.now()
  });
  layout.seats[seatNum] = null;

  selectedSeatNum = null;
  selectedWaitingIndex = null;

  renderLayout();
  renderWaitList();
  saveLayout();

  // 🔥 아주 짧게 뒤에 click 다시 허용
  setTimeout(() => {
    suppressClick = false;
  }, 0);
});


/* =================================================
   ADD WAITING
   ================================================= */
function addWaiting(name) {
  if (!name || isAddingWaiting) return;

  isAddingWaiting = true;

  layout.waiting.push({
    name,
    startedAt: Date.now()
  });

  renderWaitList();
  saveLayout();

  setTimeout(() => {
    isAddingWaiting = false;
  }, 0);
}


document.addEventListener("keydown", e => {
  const input = e.target.closest("#waitingNameInput");
  if (!input || e.key !== "Enter") return;

  e.preventDefault();
  e.stopPropagation(); // 🔥 핵심

  const name = input.value.trim();
  if (!name) return;

  input.value = "";
  addWaiting(name);
});


/* =================================================
   SAVE (BACKGROUND)
   ================================================= */
function saveLayout() {
  const boxId = getBoxId();
  if (!boxId) return;

  isSaving = true;

  getDoc(STATE_REF).then(snap => {
    if (!snap.exists()) return;

    const boxes = snap.data().boxes || [];
    const idx = boxes.findIndex(b => b.id === boxId);
    if (idx === -1) return;

    boxes[idx] = {
      ...boxes[idx],
      layout: {
        seats: layout.seats,
        waiting: layout.waiting
      }
    };

    return setDoc(STATE_REF, { boxes }, { merge: true });
  }).finally(() => {
    setTimeout(() => {
      isSaving = false;
    }, 100);
  });
}

/* =================================================
   TIMER
   ================================================= */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll(".time[data-start]").forEach(el => {
    const start = Number(el.dataset.start);
    if (start) el.textContent = formatElapsed(now - start);
  });
}, 1000);
