// layout_app.js — BoxBoard Layout (PRODUCTION BASE)
// Firestore + Role + Timer + Shortcuts
// Seat is FIXED slot. People move, seats do not.

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
const waitingListEl = $("waitingList");
const addSeatBtn = $("addSeatBtn");
const waitingNameInput = $("waitingNameInput");
const addWaitingBtn = $("addWaitingBtn");

/* ===============================
   ROUTE / REF
=============================== */
function getBoxId() {
  return new URLSearchParams(location.search).get("boxId") || "default";
}
const boxId = getBoxId();
const DOC_REF = doc(db, "boxboard_layouts", boxId);
const LS_KEY = `boxboard_layout_${boxId}_v1`;

/* ===============================
   ROLE
=============================== */
let currentUser = null;
let currentUserRole = "user"; // "admin" | "user"

/* ===============================
   STATE (Seat is fixed slot)
=============================== */
const state = {
  version: 1,
  seats: [],    // [{id:number, name:string|null, start:number|null}]
  waiting: [],  // [{id:string, name:string, start:number}]
  updatedAt: null
};

// selection
let selectedSeatId = null;
let selectedWaitingId = null;

/* Firestore hydration / loop guard */
let hasHydrated = false;
let isSaving = false;

/* ===============================
   UTIL
=============================== */
const uid = () => "w_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now();

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function nowMs() {
  return Date.now();
}

function cloneClean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ===============================
   STORAGE
=============================== */
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    if (!Array.isArray(parsed.seats) || !Array.isArray(parsed.waiting)) return false;
    state.seats = parsed.seats;
    state.waiting = parsed.waiting;
    return true;
  } catch {
    return false;
  }
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      version: state.version,
      seats: state.seats,
      waiting: state.waiting
    }));
  } catch {}
}

/* ===============================
   ROLE UI GATE
=============================== */
function isAdmin() {
  return currentUserRole === "admin";
}

function applyRoleUI() {
  const admin = isAdmin();

  // buttons
  if (addSeatBtn) addSeatBtn.style.display = admin ? "" : "none";
  if (addWaitingBtn) addWaitingBtn.disabled = !admin;
  if (waitingNameInput) waitingNameInput.disabled = !admin;

  // hint (optional)
  document.body.dataset.role = admin ? "admin" : "user";
}

/* ===============================
   FIRESTORE
=============================== */
async function ensureUserDoc(uid) {
  // You may already manage users elsewhere; this only reads role.
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (snap.exists()) {
    const data = snap.data() || {};
    currentUserRole = data.role === "admin" ? "admin" : "user";
  } else {
    // default user role; do not auto-write role here (safer)
    currentUserRole = "user";
  }
  applyRoleUI();
}

async function saveRemote() {
  if (!currentUser) return;
  if (isSaving) return;

  isSaving = true;
  try {
    const payload = {
      version: state.version,
      seats: state.seats,
      waiting: state.waiting,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };
    await setDoc(DOC_REF, payload, { merge: true });
    saveLocal();
  } catch (e) {
    console.warn("saveRemote failed:", e);
    // still keep local
    saveLocal();
  } finally {
    // small delay prevents immediate snapshot echo from re-entering
    setTimeout(() => { isSaving = false; }, 120);
  }
}

function attachSnapshot() {
  onSnapshot(DOC_REF, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data() || {};
    const incomingSeats = Array.isArray(data.seats) ? data.seats : null;
    const incomingWaiting = Array.isArray(data.waiting) ? data.waiting : null;

    if (!incomingSeats || !incomingWaiting) return;

    // If we're saving, ignore echo unless first hydration
    if (isSaving && hasHydrated) return;

    state.seats = incomingSeats;
    state.waiting = incomingWaiting;

    // keep selections valid
    if (selectedSeatId != null && !state.seats.some(s => s.id === selectedSeatId)) selectedSeatId = null;
    if (selectedWaitingId != null && !state.waiting.some(w => w.id === selectedWaitingId)) selectedWaitingId = null;

    hasHydrated = true;
    saveLocal();
    renderAll();
  });
}

/* ===============================
   STATE HELPERS
=============================== */
function getSeatById(id) {
  return state.seats.find(s => s.id === id) || null;
}
function getWaitingById(id) {
  return state.waiting.find(w => w.id === id) || null;
}

function ensureSeatSlots(minCount = 1) {
  const maxId = state.seats.reduce((m, s) => Math.max(m, s.id), -1);
  while (state.seats.length < minCount) {
    state.seats.push({ id: maxId + 1 + (state.seats.length - minCount + 1), name: null, start: null });
  }
  // If ids got weird, normalize to 0..n-1 while preserving order
  const needsNormalize = state.seats.some((s, i) => s.id !== i);
  if (needsNormalize) {
    state.seats = state.seats.map((s, i) => ({ id: i, name: s.name ?? null, start: s.start ?? null }));
  }
}

function seatMoveToWaiting(seatId) {
  const seat = getSeatById(seatId);
  if (!seat || !seat.name) return false;

  state.waiting.push({
    id: uid(),
    name: seat.name,
    start: seat.start || nowMs()
  });

  seat.name = null;
  seat.start = null;
  return true;
}

function assignWaitingToSeat(waitId, seatId) {
  const seat = getSeatById(seatId);
  const w = getWaitingById(waitId);
  if (!seat || !w) return false;

  if (!seat.name) {
    // assign into empty seat
    seat.name = w.name;
    seat.start = w.start || nowMs();
    state.waiting = state.waiting.filter(x => x.id !== waitId);
    return true;
  }

  // swap (seat occupant becomes waiting)
  const prev = { id: uid(), name: seat.name, start: seat.start || nowMs() };

  seat.name = w.name;
  seat.start = w.start || nowMs();

  // replace selected waiting with previous seat occupant (keeps position feel)
  state.waiting = state.waiting.map(x => x.id === waitId ? prev : x);
  selectedWaitingId = prev.id;
  return true;
}

function editSelectedName() {
  if (!isAdmin()) return;

  if (selectedSeatId != null) {
    const seat = getSeatById(selectedSeatId);
    if (!seat) return;
    const cur = seat.name || "";
    const next = prompt("Seat 이름 수정", cur);
    if (next === null) return;
    const trimmed = next.trim();
    seat.name = trimmed ? trimmed : null;
    if (seat.name && !seat.start) seat.start = nowMs();
    if (!seat.name) seat.start = null;
    saveRemote();
    renderAll();
    return;
  }

  if (selectedWaitingId != null) {
    const w = getWaitingById(selectedWaitingId);
    if (!w) return;
    const next = prompt("대기자 이름 수정", w.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    w.name = trimmed;
    saveRemote();
    renderAll();
  }
}

function deleteSelected() {
  if (!isAdmin()) return;

  if (selectedWaitingId != null) {
    state.waiting = state.waiting.filter(w => w.id !== selectedWaitingId);
    selectedWaitingId = null;
    saveRemote();
    renderAll();
    return;
  }

  if (selectedSeatId != null) {
    const seat = getSeatById(selectedSeatId);
    if (!seat) return;

    if (seat.name) {
      // safer: move occupant to waiting instead of hard delete
      seatMoveToWaiting(seat.id);
    } else {
      // remove seat slot only if last seat (prevents layout collapse accidents)
      // (admin can still add seats back)
      if (state.seats.length > 1 && seat.id === state.seats.length - 1) {
        state.seats.pop();
        if (selectedSeatId === seat.id) selectedSeatId = null;
      }
    }
    saveRemote();
    renderAll();
  }
}

function clearSelection() {
  selectedSeatId = null;
  selectedWaitingId = null;
  renderAll();
}

/* ===============================
   RENDER
=============================== */
function seatCardHTML(seat) {
  const title = seat.name ? seat.name : `Empty (Seat ${seat.id + 1})`;
  const elapsed = seat.start ? formatElapsed(nowMs() - seat.start) : "";
  const pill = seat.name ? `<span class="pill running">Running</span>` : `<span class="pill waiting">Empty</span>`;

  return `
    <div class="badge">Seat #${seat.id + 1}</div>
    <div class="row">
      <div class="name">${escapeHtml(title)}</div>
      <div class="time" data-start="${seat.start || ""}">${elapsed}</div>
    </div>
    <div class="row row-bottom">
      ${pill}
      ${isAdmin() ? `<button class="seat-delete" data-seat-del="${seat.id}" title="Seat 삭제">×</button>` : ``}
    </div>
  `;
}

function waitingCardHTML(w, idx) {
  const elapsed = w.start ? formatElapsed(nowMs() - w.start) : "";
  return `
    <div class="badge">Waiting #${idx + 1}</div>
    <div class="row">
      <div class="name">${escapeHtml(w.name)}</div>
      <div class="time" data-start="${w.start || ""}">${elapsed}</div>
    </div>
    ${isAdmin() ? `<button class="wait-delete" data-wait-del="${w.id}" title="대기자 삭제">×</button>` : ``}
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function renderAll() {
  if (!gridEl || !waitingListEl) return;

  // Seats
  gridEl.innerHTML = "";
  const gridWrap = document.createElement("div");
  gridWrap.className = "layout-grid";

  state.seats.forEach((seat) => {
    const card = document.createElement("div");
    card.className = "card seat-card" + (selectedSeatId === seat.id ? " selected" : "");
    card.dataset.seatId = String(seat.id);
    card.innerHTML = seatCardHTML(seat);
    gridWrap.appendChild(card);
  });

  gridEl.appendChild(gridWrap);

  // Waiting
  waitingListEl.innerHTML = "";
  if (state.waiting.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "대기자가 없습니다.";
    waitingListEl.appendChild(empty);
  } else {
    const row = document.createElement("div");
    row.className = "waiting-row";
    state.waiting.forEach((w, idx) => {
      const card = document.createElement("div");
      card.className = "card waiting-card" + (selectedWaitingId === w.id ? " selected" : "");
      card.dataset.waitId = w.id;
      card.innerHTML = waitingCardHTML(w, idx);
      row.appendChild(card);
    });
    waitingListEl.appendChild(row);
  }

  applyRoleUI();
}

/* Update only timers every second (no full rerender) */
function updateTimersOnly() {
  document.querySelectorAll(".time[data-start]").forEach((el) => {
    const v = el.getAttribute("data-start");
    const start = v ? Number(v) : 0;
    if (!start) return;
    el.textContent = formatElapsed(nowMs() - start);
  });
}

/* ===============================
   EVENT BINDINGS
=============================== */
function bindUI() {
  // Add seat (admin only)
  addSeatBtn?.addEventListener("click", () => {
    if (!isAdmin()) return;
    const nextId = state.seats.length;
    state.seats.push({ id: nextId, name: null, start: null });
    saveRemote();
    renderAll();
  });

  // Add waiting (admin only)
  addWaitingBtn?.addEventListener("click", () => {
    if (!isAdmin()) return;
    const name = (waitingNameInput?.value || "").trim();
    if (!name) return;
    state.waiting.push({ id: uid(), name, start: nowMs() });
    waitingNameInput.value = "";
    saveRemote();
    renderAll();
  });

  waitingNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addWaitingBtn?.click();
  });

  // Delegate clicks (seat & waiting)
  document.addEventListener("click", (e) => {
    const t = e.target;

    // seat delete
    const seatDel = t?.closest?.("[data-seat-del]");
    if (seatDel && isAdmin()) {
      e.preventDefault();
      e.stopPropagation();
      const seatId = Number(seatDel.getAttribute("data-seat-del"));
      const seat = getSeatById(seatId);
      if (!seat) return;
      if (seat.name) {
        seatMoveToWaiting(seatId);
      } else {
        // allow removing only last seat
        if (state.seats.length > 1 && seatId === state.seats.length - 1) {
          state.seats.pop();
          if (selectedSeatId === seatId) selectedSeatId = null;
        }
      }
      saveRemote();
      renderAll();
      return;
    }

    // wait delete
    const waitDel = t?.closest?.("[data-wait-del]");
    if (waitDel && isAdmin()) {
      e.preventDefault();
      e.stopPropagation();
      const wid = waitDel.getAttribute("data-wait-del");
      state.waiting = state.waiting.filter(w => w.id !== wid);
      if (selectedWaitingId === wid) selectedWaitingId = null;
      saveRemote();
      renderAll();
      return;
    }

    // waiting card click
    const waitCard = t?.closest?.(".waiting-card");
    if (waitCard) {
      const wid = waitCard.dataset.waitId;
      if (!wid) return;

      // if a seat is selected -> assign/swap
      if (selectedSeatId != null && isAdmin()) {
        const changed = assignWaitingToSeat(wid, selectedSeatId);
        if (changed) {
          selectedSeatId = null;
          saveRemote();
          renderAll();
        }
        return;
      }

      selectedWaitingId = (selectedWaitingId === wid) ? null : wid;
      selectedSeatId = null;
      renderAll();
      return;
    }

    // seat card click
    const seatCard = t?.closest?.(".seat-card");
    if (seatCard) {
      const seatId = Number(seatCard.dataset.seatId);
      if (Number.isNaN(seatId)) return;

      // if waiting selected -> assign/swap (admin)
      if (selectedWaitingId != null && isAdmin()) {
        const changed = assignWaitingToSeat(selectedWaitingId, seatId);
        if (changed) {
          selectedWaitingId = null;
          saveRemote();
          renderAll();
        }
        return;
      }

      selectedSeatId = (selectedSeatId === seatId) ? null : seatId;
      selectedWaitingId = null;
      renderAll();
      return;
    }

    // click outside -> clear selection
    const inside = t?.closest?.(".seat-card, .waiting-card, .waiting-header, .layout-top");
    if (!inside) clearSelection();
  });

  // dblclick seat -> move occupant to waiting (admin)
  document.addEventListener("dblclick", (e) => {
    if (!isAdmin()) return;
    const seatCard = e.target?.closest?.(".seat-card");
    if (!seatCard) return;
    const seatId = Number(seatCard.dataset.seatId);
    const seat = getSeatById(seatId);
    if (!seat || !seat.name) return;
    seatMoveToWaiting(seatId);
    saveRemote();
    renderAll();
  });

  // Shortcuts
  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(document.activeElement)) return;

    // Esc: clear selection
    if (e.key === "Escape") {
      clearSelection();
      return;
    }

    // W: focus waiting input
    if (e.key === "w" || e.key === "W") {
      if (!isAdmin()) return;
      waitingNameInput?.focus();
      waitingNameInput?.select?.();
      return;
    }

    // A: add seat
    if (e.key === "a" || e.key === "A") {
      if (!isAdmin()) return;
      addSeatBtn?.click();
      return;
    }

    // E: edit name
    if (e.key === "e" || e.key === "E") {
      if (!isAdmin()) return;
      editSelectedName();
      return;
    }

    // Delete / Backspace: delete selected
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!isAdmin()) return;
      deleteSelected();
      return;
    }

    // Cmd/Ctrl + S : force save (admin)
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      if (!isAdmin()) return;
      e.preventDefault();
      saveRemote();
    }
  });
}

/* ===============================
   BOOT
=============================== */
function bootDefaultState() {
  if (state.seats.length === 0) state.seats = [{ id: 0, name: null, start: null }];
  ensureSeatSlots(1);
}

function init() {
  // local first for instant UI
  loadLocal();
  bootDefaultState();
  renderAll();
  setInterval(updateTimersOnly, 1000);

  bindUI();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;

    if (!currentUser) {
      // no auth: readonly user mode
      currentUserRole = "user";
      applyRoleUI();
      // still attach snapshot to view live state if rules allow read
      attachSnapshot();
      return;
    }

    await ensureUserDoc(currentUser.uid);
    attachSnapshot();

    // If remote doc is empty and we have local, push once (admin only)
    if (isAdmin()) {
      try {
        const snap = await getDoc(DOC_REF);
        if (!snap.exists()) {
          await saveRemote();
        }
      } catch {}
    }
  });
}

init();
