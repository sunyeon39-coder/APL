// layout_app.js — FIRESTORE + ROLE + TIMER + SHORTCUTS (CLICK SAFE)
// 요구사항: Seat/Waiting 스왑, 더블클릭 Seat -> Waiting 이동, Role 기반 UI, Firestore 동기화, 타이머, 단축키

import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM
=============================== */
const $ = (id) => document.getElementById(id);

const gridEl = $("layoutGrid");
const waitingEl = $("waitingList");
const emptySeatsEl = $("emptySeats");
const emptyWaitingEl = $("emptyWaiting");

const addSeatBtn = $("addSeatBtn");
const waitingInput = $("waitingNameInput");
const addWaitingBtn = $("addWaitingBtn");

const syncPill = $("syncPill");
const rolePill = $("rolePill");

/* ===============================
   STATE
=============================== */
const boxId = new URLSearchParams(location.search).get("boxId") || "default";

const LS_KEY = `boxboard_layout_${boxId}_v1`;

let currentUser = null;
let currentUserRole = "user"; // user | admin

// 데이터 모델
// layout.seats: { [seatNum]: { name: string, start: number } }
// layout.waiting: Array<{ name: string, start: number }>
const layout = {
  seats: {},
  waiting: []
};

let selectedSeatNum = null;
let selectedWaitingIndex = null;

// Firestore 보호 플래그
let hydrated = false;
let isSaving = false;

// Firestore doc
const LAYOUT_REF = doc(db, "boxboard_layouts", boxId);

/* ===============================
   UTILS
=============================== */
function now() { return Date.now(); }

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

function seatNumsSorted() {
  return Object.keys(layout.seats)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b) => a-b);
}

function nextSeatNum() {
  const nums = seatNumsSorted();
  if (!nums.length) return 1;
  return Math.max(...nums) + 1;
}

function setPill(el, text, clsAdd, clsRemove) {
  el.textContent = text;
  el.classList.remove(...clsRemove);
  el.classList.add(...clsAdd);
}

/* ===============================
   LOCAL STORAGE
=============================== */
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.seats) layout.seats = parsed.seats;
      if (Array.isArray(parsed.waiting)) layout.waiting = parsed.waiting;
      return true;
    }
  } catch (e) {}
  return false;
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      seats: layout.seats,
      waiting: layout.waiting
    }));
  } catch (e) {}
}

/* ===============================
   ROLE
=============================== */
async function fetchRole(uid) {
  try {
    const uref = doc(db, "users", uid);
    const snap = await getDoc(uref);
    const role = snap.exists() ? (snap.data().role || "user") : "user";
    return (role === "admin") ? "admin" : "user";
  } catch (e) {
    return "user";
  }
}

function applyRoleUI() {
  const isAdmin = currentUserRole === "admin";

  // 버튼 가시성
  addSeatBtn.style.display = isAdmin ? "" : "none";
  addWaitingBtn.style.display = isAdmin ? "" : "none";
  waitingInput.disabled = !isAdmin;

  // 삭제 버튼은 렌더에서 role로 제어
  rolePill.textContent = `ROLE: ${currentUserRole.toUpperCase()}`;
}

/* ===============================
   FIRESTORE
=============================== */
async function saveRemote() {
  // admin만 쓰기 허용 (원하면 user도 허용 가능)
  if (currentUserRole !== "admin") return;

  isSaving = true;
  saveLocal();

  try {
    await setDoc(LAYOUT_REF, {
      seats: layout.seats,
      waiting: layout.waiting,
      updatedAt: serverTimestamp()
    }, { merge: true });

    setPill(syncPill, "SYNC", ["online"], ["offline"]);
  } catch (e) {
    setPill(syncPill, "OFFLINE", ["offline"], ["online"]);
  } finally {
    isSaving = false;
  }
}

let saveTimer = null;
function saveRemoteDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRemote, 200);
}

function bindSnapshot() {
  onSnapshot(LAYOUT_REF, (snap) => {
    // 처음엔 로컬 먼저, 서버 있으면 덮어쓰기
    if (!snap.exists()) {
      if (!hydrated) {
        hydrated = true;
        render();
      }
      setPill(syncPill, "OFFLINE", ["offline"], ["online"]);
      return;
    }

    setPill(syncPill, "LIVE", ["online"], ["offline"]);

    if (isSaving) return;

    const data = snap.data() || {};
    // 서버 데이터 → 로컬 반영
    if (data.seats) layout.seats = data.seats;
    if (Array.isArray(data.waiting)) layout.waiting = data.waiting;

    hydrated = true;
    saveLocal();
    render();
  }, () => {
    setPill(syncPill, "OFFLINE", ["offline"], ["online"]);
  });
}

/* ===============================
   ACTIONS
=============================== */
function clearSelection() {
  selectedSeatNum = null;
  selectedWaitingIndex = null;
}

function addSeat() {
  if (currentUserRole !== "admin") return;
  const n = nextSeatNum();
  layout.seats[String(n)] = { name: `Seat ${n}`, start: now() };
  clearSelection();
  render();
  saveRemoteDebounced();
}

function deleteSeat(seatNum) {
  if (currentUserRole !== "admin") return;
  delete layout.seats[String(seatNum)];
  if (selectedSeatNum === seatNum) selectedSeatNum = null;
  render();
  saveRemoteDebounced();
}

function addWaiting(name) {
  if (currentUserRole !== "admin") return;
  const n = String(name || "").trim();
  if (!n) return;
  layout.waiting.push({ name: n, start: now() });
  waitingInput.value = "";
  selectedWaitingIndex = layout.waiting.length - 1;
  render();
  saveRemoteDebounced();
}

function deleteWaiting(idx) {
  if (currentUserRole !== "admin") return;
  layout.waiting.splice(idx, 1);
  if (selectedWaitingIndex === idx) selectedWaitingIndex = null;
  render();
  saveRemoteDebounced();
}

// Seat ↔ Waiting 스왑/할당
function swapSeatWaiting(seatNum, wIdx) {
  const sKey = String(seatNum);
  const seatObj = layout.seats[sKey] || { name: `Seat ${seatNum}`, start: now() };
  const wObj = layout.waiting[wIdx];

  // 스왑: seat.name <-> waiting.name
  const tmp = { ...seatObj };
  layout.seats[sKey] = { name: wObj.name, start: wObj.start ?? now() };
  layout.waiting[wIdx] = { name: tmp.name, start: tmp.start ?? now() };

  clearSelection();
  render();
  saveRemoteDebounced();
}

// Seat 더블클릭: Seat 사람을 Waiting으로 빼기 (Seat 비우기 X → 기본 Seat명으로 돌림)
function seatToWaiting(seatNum) {
  if (currentUserRole !== "admin") return;
  const sKey = String(seatNum);
  const seatObj = layout.seats[sKey];
  if (!seatObj || !seatObj.name) return;

  layout.waiting.unshift({ name: seatObj.name, start: seatObj.start ?? now() });
  layout.seats[sKey] = { name: `Seat ${seatNum}`, start: now() };

  clearSelection();
  render();
  saveRemoteDebounced();
}

// 이름 변경
function renameSelected() {
  if (currentUserRole !== "admin") return;

  if (selectedSeatNum !== null) {
    const sKey = String(selectedSeatNum);
    const cur = layout.seats[sKey]?.name || "";
    const next = prompt("Seat 이름 변경", cur);
    if (next && next.trim()) {
      layout.seats[sKey].name = next.trim();
      render();
      saveRemoteDebounced();
    }
    return;
  }

  if (selectedWaitingIndex !== null) {
    const cur = layout.waiting[selectedWaitingIndex]?.name || "";
    const next = prompt("대기자 이름 변경", cur);
    if (next && next.trim()) {
      layout.waiting[selectedWaitingIndex].name = next.trim();
      render();
      saveRemoteDebounced();
    }
  }
}

/* ===============================
   RENDER
=============================== */
function render() {
  // seats
  gridEl.innerHTML = "";
  const seatNums = seatNumsSorted();

  emptySeatsEl.classList.toggle("hidden", seatNums.length !== 0);

  seatNums.forEach((seatNum) => {
    const sKey = String(seatNum);
    const seatObj = layout.seats[sKey];

    const card = document.createElement("div");
    card.className = "card";
    if (selectedSeatNum === seatNum) card.classList.add("selected");

    const top = document.createElement("div");
    top.className = "row";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = seatObj?.name || `Seat ${seatNum}`;

    const time = document.createElement("div");
    time.className = "time";
    const start = Number(seatObj?.start || now());
    time.textContent = formatElapsed(now() - start);

    top.appendChild(name);
    top.appendChild(time);

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.innerHTML = `<span class="badge">Seat #${seatNum}</span>`;

    card.appendChild(top);
    card.appendChild(sub);

    // 클릭
    card.addEventListener("click", () => {
      // waiting 선택 상태면 스왑
      if (selectedWaitingIndex !== null) {
        swapSeatWaiting(seatNum, selectedWaitingIndex);
        return;
      }
      selectedSeatNum = seatNum;
      selectedWaitingIndex = null;
      render();
    });

    // 더블클릭 → waiting으로 빼기
    card.addEventListener("dblclick", (e) => {
      e.preventDefault();
      seatToWaiting(seatNum);
    });

    // 삭제 버튼 (admin)
    if (currentUserRole === "admin") {
      const del = document.createElement("button");
      del.className = "seat-delete";
      del.textContent = "×";
      del.title = "Seat 삭제";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSeat(seatNum);
      });
      card.appendChild(del);
    }

    gridEl.appendChild(card);
  });

  // waiting
  waitingEl.innerHTML = "";
  emptyWaitingEl.classList.toggle("hidden", layout.waiting.length !== 0);

  layout.waiting.forEach((w, idx) => {
    const card = document.createElement("div");
    card.className = "card waiting-card";
    if (selectedWaitingIndex === idx) {
      card.classList.add("selected", "waitingSel");
    }

    const top = document.createElement("div");
    top.className = "row";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = w?.name || "-";

    const time = document.createElement("div");
    time.className = "time";
    const start = Number(w?.start || now());
    time.textContent = formatElapsed(now() - start);

    top.appendChild(name);
    top.appendChild(time);

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.innerHTML = `<span class="badge">Waiting #${idx+1}</span>`;

    card.appendChild(top);
    card.appendChild(sub);

    card.addEventListener("click", () => {
      // seat 선택 상태면 스왑
      if (selectedSeatNum !== null) {
        swapSeatWaiting(selectedSeatNum, idx);
        return;
      }
      selectedWaitingIndex = idx;
      selectedSeatNum = null;
      render();
    });

    if (currentUserRole === "admin") {
      const del = document.createElement("button");
      del.className = "wait-delete";
      del.textContent = "×";
      del.title = "대기자 삭제";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteWaiting(idx);
      });
      card.appendChild(del);
    }

    waitingEl.appendChild(card);
  });
}

/* ===============================
   TIMERS
=============================== */
setInterval(() => {
  // 화면을 매초 통째로 다시 그릴 필요 없이
  // 간단히 텍스트만 업데이트하려면 selector로 time만 갱신해도 되지만,
  // 카드 수가 많지 않으니 안전하게 render는 피하고 time만 갱신
  document.querySelectorAll(".card .time").forEach((el) => {
    const parent = el.closest(".card");
    if (!parent) return;

    // seat 카드인지 waiting 카드인지 판별
    const seatBadge = parent.querySelector(".badge")?.textContent || "";

    if (seatBadge.startsWith("Seat #")) {
      const seatNum = Number(seatBadge.replace("Seat #",""));
      const obj = layout.seats[String(seatNum)];
      if (!obj) return;
      el.textContent = formatElapsed(now() - Number(obj.start || now()));
      return;
    }

    if (seatBadge.startsWith("Waiting #")) {
      const idx = Number(seatBadge.replace("Waiting #","")) - 1;
      const obj = layout.waiting[idx];
      if (!obj) return;
      el.textContent = formatElapsed(now() - Number(obj.start || now()));
    }
  });
}, 1000);

/* ===============================
   EVENTS
=============================== */
addSeatBtn?.addEventListener("click", addSeat);

addWaitingBtn?.addEventListener("click", () => {
  addWaiting(waitingInput.value);
});

waitingInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addWaiting(waitingInput.value);
  }
});

// 단축키
window.addEventListener("keydown", (e) => {
  // 입력 중이면 최소한만 허용
  const isTyping = document.activeElement &&
    ["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName);

  if (e.key === "Escape") {
    clearSelection();
    render();
    return;
  }

  if (isTyping) return;

  // W: waiting 입력 포커스
  if (e.key.toLowerCase() === "w") {
    e.preventDefault();
    if (currentUserRole === "admin") waitingInput?.focus();
    return;
  }

  // E: 이름 변경
  if (e.key.toLowerCase() === "e") {
    e.preventDefault();
    renameSelected();
    return;
  }

  // A: Seat 추가
  if (e.key.toLowerCase() === "a") {
    e.preventDefault();
    addSeat();
    return;
  }

  // Delete: 선택 삭제
  if (e.key === "Delete" || e.key === "Backspace") {
    if (currentUserRole !== "admin") return;

    if (selectedSeatNum !== null) {
      deleteSeat(selectedSeatNum);
      return;
    }
    if (selectedWaitingIndex !== null) {
      deleteWaiting(selectedWaitingIndex);
    }
  }

  // Ctrl/Cmd+S: 저장
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveRemoteDebounced();
  }
});

/* ===============================
   BOOT
=============================== */
(function boot() {
  // 로컬 먼저
  loadLocal();
  render();

  setPill(syncPill, "OFFLINE", ["offline"], ["online"]);
  rolePill.textContent = "ROLE: -";

  // auth + role
  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    currentUserRole = user ? await fetchRole(user.uid) : "user";
    applyRoleUI();
    render();

    // 서버 동기화 시작
    bindSnapshot();

    // 최초 1회: 서버에 문서 없으면 로컬을 올려두기 (admin만)
    if (!hydrated && currentUserRole === "admin") {
      saveRemoteDebounced();
    }
  });
})();
