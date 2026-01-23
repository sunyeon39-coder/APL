/* =================================================
   BoxBoard Layout App – FINAL STABLE (Layout ONLY)
   ================================================= */

let selectedSeat = null;
let selectedWaiting = null;

let state = null;
let box = null;

/* ===============================
   STORAGE
   =============================== */
function loadState() {
  return JSON.parse(localStorage.getItem("boxboard_v1_state") || "{}");
}

function saveState() {
  localStorage.setItem("boxboard_v1_state", JSON.stringify(state));
}

function getBoxId() {
  return new URLSearchParams(location.search).get("boxId");
}

/* ===============================
   TIMER
   =============================== */
function updateTimes() {
  const now = Date.now();
  document.querySelectorAll(".time[data-start]").forEach(el => {
    const start = Number(el.dataset.start);
    if (!start) return;
    const diff = Math.floor((now - start) / 1000);
    el.textContent =
      String(Math.floor(diff / 60)).padStart(2, "0") +
      ":" +
      String(diff % 60).padStart(2, "0");
  });
}

/* ===============================
   INIT (단 1번)
   =============================== */
document.addEventListener("DOMContentLoaded", () => {
  state = loadState();
  if (!state?.boxes) return;

  box = state.boxes.find(b => b.id === getBoxId());
  if (!box) return;

  box.seats ||= {};
  box.waiting ||= [];

  renderLayout();
  renderWaitList();
  setInterval(updateTimes, 1000);

  /* Seat Add */
  document.getElementById("addSeatBtn")?.addEventListener("click", () => {
    const n = Number(prompt("Seat 번호 입력"));
    if (!Number.isInteger(n) || n <= 0) return;

    if (box.seats[n]) return alert("이미 존재");

    box.seats[n] = null;
    saveState();
    renderLayout();
  });

  /* Waiting Add */
  const waitingInput = document.getElementById("waitingNameInput");
  const addWaitingBtn = document.getElementById("addWaitingBtn");

  const addWaiting = () => {
    const name = waitingInput.value.trim();
    if (!name) return;

    box.waiting.push({
      id: "w_" + Date.now(),
      name,
      startedAt: Date.now()
    });

    waitingInput.value = "";
    saveState();
    renderWaitList();
  };

  addWaitingBtn?.addEventListener("click", addWaiting);
  waitingInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") addWaiting();
  });
});

/* ===============================
   ASSIGN
   =============================== */
function tryAssign() {
  if (!selectedSeat || !selectedWaiting) return;

  const i = selectedSeat.seatIndex;

  if (box.seats[i]) {
    box.waiting.push({
      id: "w_" + Date.now(),
      name: box.seats[i].name,
      startedAt: Date.now()
    });
  }

  box.seats[i] = {
    id: selectedWaiting.id,
    name: selectedWaiting.name,
    startedAt: Date.now()
  };

  box.waiting = box.waiting.filter(w => w.id !== selectedWaiting.id);

  selectedSeat = null;
  selectedWaiting = null;

  saveState();
  renderLayout();
  renderWaitList();
}

/* ===============================
   RENDER SEATS
   =============================== */
function renderLayout() {
  const grid = document.getElementById("layoutGrid");
  if (!grid) return;

  grid.innerHTML = "";

  Object.keys(box.seats)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(i => {
      const d = box.seats[i];
      const seat = document.createElement("section");
      seat.className = "card collapsed";
      seat._blockClick = false;

      seat.innerHTML = `
        <div class="badge">Seat ${i}</div>
        <button class="seat-delete wait-delete">×</button>
        <h3>${d ? d.name : "비어있음"}</h3>
        <div class="meta">
          ${
            d
              ? `<div class="pill good">
                   Running · <span class="time" data-start="${d.startedAt}">00:00</span>
                 </div>`
              : `<div class="pill">Empty</div>`
          }
        </div>
      `;

      seat.onclick = () => {
        if (seat._blockClick) return;
        selectedSeat = { seatIndex: i };
        if (selectedWaiting) tryAssign();
      };

      seat.ondblclick = e => {
  e.preventDefault();
  e.stopPropagation();

  seat._blockClick = true;
  setTimeout(() => (seat._blockClick = false), 0);

  // 좌석에 사람이 없으면 아무것도 안 함
  if (!box.seats[i]) return;

  // 1) 배치된 사람을 대기자로 이동 (중복 방지)
  const person = box.seats[i];
  const already = box.waiting.some(w => w.id === person.id);
  if (!already) {
    box.waiting.push({
      id: person.id,          // ✅ 기존 사람 id 유지 (중복 방지 핵심)
      name: person.name,
      startedAt: Date.now()
    });
  }

  // 2) 좌석은 삭제하지 말고 "비움" 처리
  box.seats[i] = null;

  saveState();
  renderLayout();
  renderWaitList();
};

      seat.querySelector(".seat-delete").onclick = e => {
        e.stopPropagation();
        delete box.seats[i];
        saveState();
        renderLayout();
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
      <span class="time" data-start="${w.startedAt}">00:00</span>
      <button class="seat-delete wait-delete">×</button>
      <h3>${w.name}</h3>
    `;

    card.onclick = () => (selectedWaiting = w);

    card.querySelector(".wait-delete").onclick = e => {
      e.stopPropagation();
      box.waiting = box.waiting.filter(x => x.id !== w.id);
      saveState();
      renderWaitList();
    };

    list.appendChild(card);
  });
}
