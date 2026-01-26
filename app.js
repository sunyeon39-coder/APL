/* =================================================
   Box Board – FINAL SYNC VERSION
   Firestore = Source of Truth
   ================================================= */

import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   CONST
   =============================== */
const STATE_REF = doc(db, "boxboard", "state");
const LS_KEY = "boxboard_state_v2";

/* ===============================
   STATE
   =============================== */
const state = {
  dateText: "",
  boxes: []
};

let hydrated = false; // Firestore 최초 수신 여부

/* ===============================
   UTIL
   =============================== */
const $ = sel => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2) + Date.now();

/* ===============================
   LOCAL (fallback only)
   =============================== */
function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    state.dateText = parsed.dateText || "";
    state.boxes = parsed.boxes || [];
    return true;
  } catch {
    return false;
  }
}

/* ===============================
   FIRESTORE SUBSCRIBE (🔥 핵심)
   =============================== */
function subscribeState() {
  onSnapshot(STATE_REF, snap => {
    if (!snap.exists()) return;

    const data = snap.data();

    hydrated = true;

    state.dateText = data.dateText || "";
    state.boxes = Array.isArray(data.boxes) ? data.boxes : [];

    saveLocal();
    render();
  });
}

/* ===============================
   WRITE (단방향)
   =============================== */
async function writeState() {
  await setDoc(STATE_REF, {
    dateText: state.dateText,
    boxes: state.boxes
  }, { merge: true });
}

/* ===============================
   RENDER
   =============================== */
function render() {
  $("#dateText").textContent = state.dateText || "";

  const board = $("#board");
  board.innerHTML = "";

  state.boxes.forEach(b => {
    const card = document.createElement("section");
    card.className = `card ${b.status?.toLowerCase() || ""}`;

    card.innerHTML = `
      <div class="badge">${b.status || "Opened"}</div>

      <div class="card-hover-bar">
        <div class="card-hover-title">${b.title}</div>
        <div class="card-hover-actions">
          <button class="hover-btn edit">✏</button>
          <button class="hover-btn del">✕</button>
        </div>
      </div>

      <h2 class="card-title">${b.title}</h2>

      <div class="meta">
        <div class="pill"><div class="k">Buy-in</div><div class="v">${b.buyin || "-"}</div></div>
        <div class="pill"><div class="k">Time</div><div class="v">${b.time || "-"}</div></div>
        <div class="pill"><div class="k">${b.extraLabel || "Entries"}</div><div class="v">${b.extraValue || "-"}</div></div>
      </div>
    `;

    // ▶ layout 이동
    card.addEventListener("click", () => {
      location.href = `layout_index.html?boxId=${b.id}`;
    });

    // ✏ edit
    card.querySelector(".edit").onclick = e => {
      e.stopPropagation();
      openBoxModal(b);
    };

    // ❌ delete
    card.querySelector(".del").onclick = async e => {
      e.stopPropagation();
      if (!confirm("삭제할까요?")) return;
      state.boxes = state.boxes.filter(x => x.id !== b.id);
      saveLocal();
      render();
      await writeState();
    };

    board.appendChild(card);
  });
}

/* ===============================
   BOX MODAL
   =============================== */
let editingId = null;

function openBoxModal(box = null) {
  editingId = box?.id || null;

  $("#boxTitle").value = box?.title || "";
  $("#boxStatus").value = box?.status || "Opened";
  $("#boxBuyin").value = box?.buyin || "";
  $("#boxTime").value = box?.time || "";
  $("#boxExtraLabel").value = box?.extraLabel || "Entries";
  $("#boxExtraValue").value = box?.extraValue || "";

  $("#overlayBox").classList.remove("hidden");
}

function closeBoxModal() {
  $("#overlayBox").classList.add("hidden");
  editingId = null;
}

/* ===============================
   INIT
   =============================== */
document.addEventListener("DOMContentLoaded", () => {

  // 🔥 Firestore 먼저
  subscribeState();

  // 🔹 fallback only
  setTimeout(() => {
    if (!hydrated) {
      loadLocal();
      render();
    }
  }, 500);

  // Add Box
  $("#addBoxBtn").onclick = () => openBoxModal();

  // Save Box
  $("#saveBox").onclick = async () => {
    const box = {
      id: editingId || uid(),
      title: $("#boxTitle").value.trim() || "Untitled",
      status: $("#boxStatus").value,
      buyin: $("#boxBuyin").value,
      time: $("#boxTime").value,
      extraLabel: $("#boxExtraLabel").value,
      extraValue: $("#boxExtraValue").value
    };

    if (editingId) {
      state.boxes = state.boxes.map(b => b.id === editingId ? box : b);
    } else {
      state.boxes.push(box);
    }

    saveLocal();
    render();
    closeBoxModal();
    await writeState();
  };

  $("#cancelBox").onclick = closeBoxModal;

  // Text editor (E)
  document.addEventListener("keydown", e => {
    if (e.key === "e") {
      $("#inputDateText").value = state.dateText || "";
      $("#overlayText").classList.remove("hidden");
    }
    if (e.key === "Escape") {
      $("#overlayText").classList.add("hidden");
      closeBoxModal();
    }
  });

  $("#saveText").onclick = async () => {
    state.dateText = $("#inputDateText").value;
    saveLocal();
    render();
    $("#overlayText").classList.add("hidden");
    await writeState();
  };

  $("#closeText").onclick = () => {
    $("#overlayText").classList.add("hidden");
  };
});
