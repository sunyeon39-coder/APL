/* =================================================
   Box Board – FINAL SYNC VERSION (AUTH SAFE)
   Firestore = Source of Truth
   ================================================= */

import { db, auth } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

let hydrated = false;
let appStarted = false;

/* ===============================
   UTIL
   =============================== */
const $ = sel => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2) + Date.now();

/* ===============================
   AUTH GUARD (🔥 핵심)
   =============================== */
let authChecked = false;

// 🔓 로그아웃 버튼
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    console.log("🚪 로그아웃 시도");
    await signOut(auth);
    console.log("✅ 로그아웃 완료");
    location.replace("/login.html");
  } catch (err) {
    console.error("❌ 로그아웃 실패", err);
  }
});


onAuthStateChanged(auth, (user) => {
  // 🔥 첫 호출: "확인 완료" 표시
  if (!authChecked) {
    authChecked = true;
  }

  if (!user) {
    console.log("❌ 로그인 안 됨 (확정) → login.html");
    location.href = "/login.html";
    return;
  }

  console.log("✅ 로그인 확인:", user.email);

  if (!appStarted) {
    appStarted = true;
    startApp();
  }
});

/* ===============================
   LOCAL SAVE (fallback only)
   =============================== */
async function saveLocal() {
  await setDoc(
    STATE_REF,
    {
      ...state,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
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
   FIRESTORE REALTIME SYNC
   =============================== */
let unsubscribe = null;

function subscribeState() {
  unsubscribe = onSnapshot(STATE_REF, snap => {
    if (!snap.exists()) return;

    const data = snap.data();
    console.log("🔥 Firestore update", data);

    state.dateText = data.dateText || "";
    state.boxes = data.boxes || [];

    hydrated = true;
    render();
  });
}

/* ===============================
   WRITE STATE
   =============================== */
async function writeState() {
  await setDoc(
    STATE_REF,
    {
      dateText: state.dateText,
      boxes: state.boxes,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
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
   APP START (🔥 Auth 이후 실행)
   =============================== */
function startApp() {
  console.log("🚀 App Started");

  // Firestore 먼저
  subscribeState();

  // fallback (Firestore 안 올 경우)
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
    render();
    $("#overlayText").classList.add("hidden");
    await writeState();
  };

  $("#closeText").onclick = () => {
    $("#overlayText").classList.add("hidden");
  };
}
