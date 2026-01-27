console.log("🔥 layout_app.js FINAL SYNC + DEBOUNCE + LOCK");

/* =================================================
   BoxBoard Layout App – FINAL SYNC + STABILITY
   ================================================= */

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
const LS_KEY = "boxboard_layout_state_v2";

/* ===============================
   CLIENT ID (기기 식별)
   =============================== */
const CLIENT_ID =
  sessionStorage.getItem("clientId") ||
  (() => {
    const id = "c_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("clientId", id);
    return id;
  })();

/* ===============================
   FLAGS
   =============================== */
let hydrated = false;
let isRemoteApplying = false;

/* ===============================
   STATE
   =============================== */
const layout = {
  seats: {},
  waiting: []
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

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* ===============================
   LOCAL (fallback)
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
   FIRESTORE SUBSCRIBE
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
   WRITE TO FIRESTORE (DEBOUNCED)
   =============================== */
async function _writeLayout(next) {
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
      ? {
          ...b,
          layout: {
            ...(b.layout || {}),
            ...next
          }
        }
      : b
  );

  await setDoc(
    STATE_REF,
    {
      boxes,
      updatedAt: serverTimestamp(),
      updatedBy: CLIENT_ID
    },
    { merge: true }
  );

  Object.assign(layout, next);
  saveLocal();
}

const writeLayout = debounce(_writeLayout, 300);


/* ===============================
   LOCK UTIL
   =============================== */
function lockSeat(seat) {
  seat.lock = {
    by: CLIENT_ID,
    until: Date.now() + 1500
  };
}

function isLockedByOther(seat) {
  return (
    seat?.lock &&
    seat.lock.by !== CLIENT_ID &&
    seat.lock.until > Date.now()
  );
}

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

      if (isLockedByOther(d)) {
        seat.classList.add("locked");
      }

    seat.innerHTML = `
  <div class="badge">Seat ${i}</div>
  <button class="seat-delete">×</button>

  <div class="seat-main">
    <h3>${d ? d.name : "비어있음"}</h3>
    ${
      d
        ? `<div class="pill running">
             <span class="time" data-start="${d.startedAt}">0:00</span>
           </div>`
        : ""
    }
  </div>
`;

      /* ===============================
         CLICK: waiting ↔ seat / seat ↔ seat
         =============================== */
      seat.onclick = () => {
        /* 1️⃣ waiting 선택 상태면 (기존 기능 유지) */
        if (selectedWaiting) {
          assignWaitingToSeat(i);
          selectedSeatIndex = null;

          document
            .querySelectorAll(".card.seat-selected")
            .forEach(el => el.classList.remove("seat-selected"));

          return;
        }

        /* 2️⃣ seat ↔ seat 모드 */
        if (selectedSeatIndex === null) {
          if (!layout.seats[i]) return; // 빈 seat는 첫 선택 불가
          selectedSeatIndex = i;

          document
            .querySelectorAll(".card.seat-selected")
            .forEach(el => el.classList.remove("seat-selected"));

          seat.classList.add("seat-selected");
          return;
        }

        /* 3️⃣ 같은 seat 다시 클릭 → 취소 */
        if (selectedSeatIndex === i) {
          selectedSeatIndex = null;
          seat.classList.remove("seat-selected");
          return;
        }

        /* 4️⃣ seat ↔ seat 교체 */
        const from = selectedSeatIndex;
        const to = i;

        const fromPerson = layout.seats[from];
        const toPerson = layout.seats[to] || null;

        const nextSeats = {
          ...layout.seats,
          [from]: toPerson,
          [to]: fromPerson
        };

        writeLayout({ seats: nextSeats });

        selectedSeatIndex = null;
        document
          .querySelectorAll(".card.seat-selected")
          .forEach(el => el.classList.remove("seat-selected"));
      };

      /* ===============================
         DOUBLE CLICK: seat → waiting
         =============================== */
      seat.ondblclick = e => {
        e.preventDefault();
        if (!layout.seats[i]) return;

        const p = layout.seats[i];

        writeLayout({
          seats: { ...layout.seats, [i]: null },
          waiting: [
            ...layout.waiting,
            { id: uid(), name: p.name, startedAt: Date.now() }
          ]
        });

        selectedSeatIndex = null;
        document
          .querySelectorAll(".card.seat-selected")
          .forEach(el => el.classList.remove("seat-selected"));
      };

      /* ===============================
         SEAT DELETE
         =============================== */
      seat.querySelector(".seat-delete").onclick = e => {
        e.stopPropagation();

        const next = { ...layout.seats };
        delete next[i];

        writeLayout({ seats: next });

        selectedSeatIndex = null;
        document
          .querySelectorAll(".card.seat-selected")
          .forEach(el => el.classList.remove("seat-selected"));
      };

      grid.appendChild(seat);
    });
}


/* ===============================
   RENDER – WAITING
   =============================== */
let selectedWaiting = null;
let selectedSeatIndex = null;

function renderWaitList() {
  const list = $("waitingList");
  list.innerHTML = "";

  if (!layout.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    selectedWaiting = null; // 🔒 대기자 없으면 선택도 초기화
    return;
  }

  layout.waiting.forEach(w => {
    const card = document.createElement("section");
    card.className = "waiting-card card";

    // ✅ 선택 상태 복구 (Firestore snapshot 이후에도 유지)
    if (selectedWaiting && selectedWaiting.id === w.id) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <h3>${w.name}</h3>
      <div class="pill waiting">
        <span class="time" data-start="${w.startedAt}">0:00</span>
      </div>
      <button class="wait-delete">×</button>
    `;

    // ✅ 클릭 시 선택 + 시각적 강조
    card.onclick = () => {
      selectedWaiting = w;

      document
        .querySelectorAll(".waiting-card.selected")
        .forEach(el => el.classList.remove("selected"));

      card.classList.add("selected");
    };

    // ❌ 삭제 버튼
    card.querySelector(".wait-delete").onclick = e => {
      e.stopPropagation();

      // 삭제되는 대상이 선택된 대상이면 선택 해제
      if (selectedWaiting && selectedWaiting.id === w.id) {
        selectedWaiting = null;
      }

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
   function addWaiting() {
  const input = $("waitingNameInput");
  if (!input) {
    console.warn("❌ waitingNameInput not found");
    return;
  }

  const name = input.value.trim();
  if (!name) return;

  writeLayout({
    waiting: [
      ...layout.waiting,
      {
        id: uid(),
        name,
        startedAt: Date.now()
      }
    ]
  });

  input.value = "";
}

function assignWaitingToSeat(seatIndex) {
  if (!selectedWaiting) return;

  const currentSeatPerson = layout.seats[seatIndex];

  // 1️⃣ 새로 앉을 사람
  const newSeatPerson = {
    name: selectedWaiting.name,
    startedAt: Date.now()
  };

  // 2️⃣ waiting 재구성
  let nextWaiting = layout.waiting.filter(
    w => w.id !== selectedWaiting.id
  );

  // 🔥 3️⃣ 기존 seat 사람이 있으면 waiting으로 내려보냄
  if (currentSeatPerson) {
    nextWaiting = [
      ...nextWaiting,
      {
        id: uid(),
        name: currentSeatPerson.name,
        startedAt: Date.now()
      }
    ];
  }

  // 4️⃣ seat 교체
  const nextSeats = {
    ...layout.seats,
    [seatIndex]: newSeatPerson
  };

  writeLayout({
    seats: nextSeats,
    waiting: nextWaiting
  });

  selectedWaiting = null;

  // 선택 표시 제거 (UX 안정)
  document
    .querySelectorAll(".waiting-card.selected")
    .forEach(el => el.classList.remove("selected"));
}


/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {
  subscribeLayout();

  const waitingInput = $("waitingNameInput");

waitingInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    addWaiting();
  }
});

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

    await writeLayout({ seats: layout.seats });
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
