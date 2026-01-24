console.log("LAYOUT JS PARSE OK");

/* =================================================
   BoxBoard Layout App – FINAL STABLE (PERSIST)
   ================================================= */

/* ===============================
   CONST
   =============================== */
const LS_KEY = "boxboard_layout_state";

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

const box = {
  seats: {},
  waiting: []
};
window.__box = box;

/* ===============================
   LOCAL STORAGE
   =============================== */
function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(box));
}

function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    box.seats = saved.seats || {};
    box.waiting = saved.waiting || [];
    return true;
  } catch {
    return false;
  }
}

/* ===============================
   FIRESTORE HANDLE
   =============================== */
const fs = {
  ready: false,
  db: null,
  doc: null,
  setDoc: null,
  onSnapshot: null,
  LAYOUT_REF: null,
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
   FIRESTORE INIT
   =============================== */
async function ensureFirestoreReady() {
  if (fs.ready) return true;
  try {
    const firestore = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const localFirebase = await import("./firebase.js");

    fs.doc = firestore.doc;
    fs.setDoc = firestore.setDoc;
    fs.onSnapshot = firestore.onSnapshot;
    fs.db = localFirebase.db;

    const boxId = getBoxId();
    if (!boxId) throw new Error("boxId 없음");

    fs.LAYOUT_REF = fs.doc(fs.db, "boards", boxId);
    fs.ready = true;
    return true;
  } catch {
    fs.ready = false;
    return false;
  }
}

/* ===============================
   FIRESTORE WRITE
   =============================== */
async function writeLayout(next) {
  const ok = await ensureFirestoreReady();
  if (!ok) throw new Error("Firestore unavailable");

  const merged = { ...box, ...next };
  await fs.setDoc(fs.LAYOUT_REF, merged, { merge: true });

  Object.assign(box, merged);
  saveLocal();
}

/* ===============================
   SUBSCRIBE
   =============================== */
async function subscribeLayout() {
  const ok = await ensureFirestoreReady();

  if (!ok) {
    loadLocal();
    renderLayout();
    renderWaitList();
    return;
  }

  fs.onSnapshot(fs.LAYOUT_REF, snap => {
    if (snap.exists()) {
      const data = snap.data();
      box.seats = data.seats || {};
      box.waiting = data.waiting || [];
      saveLocal();
    }
    renderLayout();
    renderWaitList();
  });
}

/* ===============================
   LOCAL FALLBACK
   =============================== */
function localCommit() {
  saveLocal();
  renderLayout();
  renderWaitList();
}

/* ===============================
   ADD WAITING
   =============================== */
async function addWaiting() {
  const input = mustEl("waitingNameInput");
  const name = input.value.trim();
  if (!name) return;

  const next = [
    ...box.waiting,
    { id: "w_" + Date.now(), name, startedAt: Date.now() }
  ];

  try {
    await writeLayout({ waiting: next });
  } catch {
    box.waiting = next;
    localCommit();
  }

  input.value = "";
}

/* ===============================
   ASSIGN
   =============================== */
async function tryAssign() {
  if (!selectedSeat || !selectedWaiting) return;

  const i = selectedSeat.seatIndex;
  const nextSeats = { ...box.seats };
  const nextWaiting = box.waiting.filter(w => w.id !== selectedWaiting.id);

  if (nextSeats[i]) {
    nextWaiting.push({ ...nextSeats[i], startedAt: Date.now() });
  }

  nextSeats[i] = { ...selectedWaiting, startedAt: Date.now() };

  selectedSeat = null;
  selectedWaiting = null;

  try {
    await writeLayout({ seats: nextSeats, waiting: nextWaiting });
  } catch {
    box.seats = nextSeats;
    box.waiting = nextWaiting;
    localCommit();
  }
}

/* ===============================
   RENDER SEATS
   =============================== */
function renderLayout() {
  const grid = document.getElementById("layoutGrid");
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(box.seats).sort((a,b)=>a-b).forEach(i => {
    const d = box.seats[i];
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

    seat.ondblclick = async e => {
      e.preventDefault();
      if (!box.seats[i]) return;

      const p = box.seats[i];
      const nextSeats = { ...box.seats, [i]: null };
      const nextWaiting = [...box.waiting, { ...p, startedAt: Date.now() }];

      try {
        await writeLayout({ seats: nextSeats, waiting: nextWaiting });
      } catch {
        box.seats = nextSeats;
        box.waiting = nextWaiting;
        localCommit();
      }
    };

    seat.querySelector(".seat-delete").onclick = async e => {
      e.stopPropagation();
      const next = { ...box.seats };
      delete next[i];

      try {
        await writeLayout({ seats: next });
      } catch {
        box.seats = next;
        localCommit();
      }
    };

    grid.appendChild(seat);
  });
}

/* ===============================
   RENDER WAITING
   =============================== */
function renderWaitList() {
  const list = document.getElementById("waitingList");
  if (!list) return;
  list.innerHTML = "";

  if (!box.waiting.length) {
    list.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  box.waiting.forEach(w => {
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

    card.querySelector(".wait-delete").onclick = async e => {
      e.stopPropagation();
      const next = box.waiting.filter(x => x.id !== w.id);
      try {
        await writeLayout({ waiting: next });
      } catch {
        box.waiting = next;
        localCommit();
      }
    };

    list.appendChild(card);
  });
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {

  // ✅ 1. 로컬 먼저 로드
  loadLocal();
  renderLayout();
  renderWaitList();

  // ✅ 2. Seat 추가
  mustEl("addSeatBtn").onclick = async () => {
    const n = Number(prompt("Seat 번호 입력"));
    if (!Number.isInteger(n) || n <= 0 || box.seats[n]) return;

    const nextSeats = { ...box.seats, [n]: null };

    // 🔥 즉시 반영
    box.seats = nextSeats;
    renderLayout();
    saveLocal();

    // 🔥 Firestore는 동기화용
    try {
      await writeLayout({ seats: nextSeats });
    } catch {
      // 이미 로컬 반영됨
    }
  };

  // ✅ 3. Back 버튼
  const backBtn = document.getElementById("layoutBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "index.html";
    });
  }

  // ✅ 4. 대기자 입력 & 버튼
  const waitingInput = mustEl("waitingNameInput");
  const addWaitingBtn = mustEl("addWaitingBtn");

  addWaitingBtn.onclick = () => {
    addWaiting();
  };

  // 🔥 5. IME 대응
  let composing = false;

  waitingInput.addEventListener("compositionstart", () => {
    composing = true;
  });

  waitingInput.addEventListener("compositionend", () => {
    composing = false;
  });

  waitingInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !composing) {
      e.preventDefault();
      addWaiting();
    }
  });

  // ✅ 6. 🔥🔥🔥 Firestore / Local subscribe 시작
  subscribeLayout();

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
