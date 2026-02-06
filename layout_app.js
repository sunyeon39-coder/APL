/* =================================================
   🔥 layout_app.js STABLE FINAL
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

let role = "user";
let hydrated = false;
let saving = false;
let unsubscribe = null;

const layout = {
  seats: {},
  waiting: []
};

const $ = id => document.getElementById(id);

/* =================================================
   BOOT
   ================================================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 layout_app.js STABLE BOOT");

  bindUI();
  bootAuth();
});

/* =================================================
   AUTH
   ================================================= */
function bootAuth() {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace("login.html");
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    role = snap.exists() ? snap.data().role || "user" : "user";

    applyRoleUI();
    subscribe();
  });
}

/* =================================================
   ROLE UI
   ================================================= */
function applyRoleUI() {
  if (role === "admin") return;

  $("addSeatBtn")?.remove();
  $("addWaitingBtn")?.remove();
}

/* =================================================
   SUBSCRIBE
   ================================================= */
function subscribe() {
  const boxId = new URLSearchParams(location.search).get("boxId");
  if (!boxId || unsubscribe) return;

  unsubscribe = onSnapshot(STATE_REF, snap => {
    if (!snap.exists() || saving) return;

    const box = snap.data().boxes?.find(b => b.id === boxId);
    if (!box) return;

    const server = box.layout || { seats: {}, waiting: [] };

    layout.seats = structuredClone(server.seats || {});
    layout.waiting = structuredClone(server.waiting || []);

    renderSeats();
    renderWaiting();
  });
}

/* =================================================
   RENDER
   ================================================= */
function renderSeats() {
  const grid = $("layoutGrid");
  if (!grid) return;

  grid.innerHTML = "";

  Object.keys(layout.seats).sort().forEach(n => {
    const seat = document.createElement("div");
    seat.className = "seat card";
    seat.dataset.seat = n;

    const data = layout.seats[n];

    seat.innerHTML = `
      <div class="badge">Seat ${n}</div>
      <h3>${data?.name || "비어있음"}</h3>
    `;

    grid.appendChild(seat);
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

  layout.waiting.forEach(w => {
    const div = document.createElement("div");
    div.className = "waiting card";
    div.textContent = w.name;
    list.appendChild(div);
  });
}

/* =================================================
   UI EVENTS
   ================================================= */
function bindUI() {
  $("addSeatBtn")?.addEventListener("click", () => {
    if (role !== "admin") return;
    const next = Object.keys(layout.seats).length + 1;
    layout.seats[next] = null;
    save();
  });

  $("addWaitingBtn")?.addEventListener("click", () => {
    const input = $("waitingNameInput");
    if (!input.value.trim()) return;
    layout.waiting.push({ name: input.value.trim(), startedAt: Date.now() });
    input.value = "";
    save();
  });
}

/* =================================================
   SAVE
   ================================================= */
function save() {
  const boxId = new URLSearchParams(location.search).get("boxId");
  if (!boxId) return;

  saving = true;

  getDoc(STATE_REF).then(snap => {
    const boxes = snap.data().boxes || [];
    const idx = boxes.findIndex(b => b.id === boxId);
    if (idx === -1) return;

    boxes[idx].layout = layout;
    return setDoc(STATE_REF, { boxes }, { merge: true });
  }).finally(() => saving = false);
}
