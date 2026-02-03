/* =================================================
   Box Board – FINAL SYNC (ADMIN / READ-ONLY USER)
   ================================================= */

import { db, auth } from "./public/firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   EVENT CONTEXT (MINIMAL PATCH)
=============================== */
const params = new URLSearchParams(location.search);
let eventId = params.get("eventId");

// 새로고침 대비
if (!eventId) {
  eventId = sessionStorage.getItem("eventId");
}
if (eventId) {
  sessionStorage.setItem("eventId", eventId);
} else {
  console.warn("⚠ eventId 없음: 단일 보드 모드");
}

/* ===============================
   CONST / STATE
   =============================== */
const STATE_REF = eventId
  ? doc(db, "boxboard", eventId)
  : doc(db, "boxboard", "state");

const state = {
  dateText: "",
  boxes: []
};

let currentUserRole = "user";
let appStarted = false;

/* ===============================
   UTIL
   =============================== */
const $ = sel => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2) + Date.now();

/* ===============================
   LOGOUT
   =============================== */
$("#logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  (window.__go ? window.__go("login.html", true) : location.replace("/login.html"));
});

/* ===============================
   AUTH GUARD
   =============================== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    (window.__go ? window.__go("login.html", true) : location.replace("/login.html"));
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name: user.displayName || "",
      role: "user",
      createdAt: serverTimestamp()
    });
    currentUserRole = "user";
  } else {
    currentUserRole = snap.data().role || "user";
  }

  console.log("👤 ROLE =", currentUserRole);

  if (!appStarted) {
    appStarted = true;
    startApp();
  }
});

/* ===============================
   FIRESTORE SUBSCRIBE
   =============================== */
function subscribeState() {
  onSnapshot(STATE_REF, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    state.dateText = data.dateText || "";
    state.boxes = data.boxes || [];
    render();
  });
}

/* ===============================
   WRITE (ADMIN ONLY)
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

    // 🔥 user / admin에 따라 DOM 자체 분기
    card.innerHTML = `
      <div class="badge">${b.status || "Opened"}</div>

      ${
        currentUserRole === "admin"
          ? `
        <div class="card-hover-bar">
          <div class="card-hover-title">${b.title}</div>
          <div class="card-hover-actions">
            <button class="hover-btn edit">✏</button>
            <button class="hover-btn del">✕</button>
          </div>
        </div>
        `
          : ""
      }

      <h2 class="card-title">${b.title}</h2>

      <div class="meta">
        <div class="pill"><div class="k">Buy-in</div><div class="v">${b.buyin || "-"}</div></div>
        <div class="pill"><div class="k">Time</div><div class="v">${b.time || "-"}</div></div>
        <div class="pill"><div class="k">${b.extraLabel || "Entries"}</div><div class="v">${b.extraValue || "-"}</div></div>
      </div>
    `;

    /* ▶ 카드 클릭: 전 유저 공통 */
    card.addEventListener("click", e => {
      if (e.target.closest(".hover-btn")) return;
      const __url = `layout_index.html?boxId=${b.id}`;
      (window.__go ? window.__go(__url, false) : (location.href = __url));
    });

    /* ===== ADMIN ONLY ACTIONS ===== */
    if (currentUserRole === "admin") {
      card.querySelector(".edit")?.addEventListener("click", e => {
        e.stopPropagation();
        openBoxModal(b);
      });

      card.querySelector(".del")?.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm("삭제할까요?")) return;
        state.boxes = state.boxes.filter(x => x.id !== b.id);
        render();
        await writeState();
      });
    }

    board.appendChild(card);
  });
}

/* ===============================
   BOX MODAL (ADMIN ONLY)
   =============================== */
let editingId = null;

function openBoxModal(box = null) {
  if (currentUserRole !== "admin") return;

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
   APP START
   =============================== */
function startApp() {
  console.log("🚀 App Start");

  const addBtn = $("#addBoxBtn");

  // 🔒 USER = 완전 제거
  if (currentUserRole !== "admin") {
    addBtn?.remove();
  } else {
    addBtn.onclick = () => openBoxModal();
  }

  subscribeState();

  /* ===== ADMIN ONLY BINDINGS ===== */
  if (currentUserRole === "admin") {
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

      editingId
        ? state.boxes = state.boxes.map(b => b.id === editingId ? box : b)
        : state.boxes.push(box);

      closeBoxModal();
      render();
      await writeState();
    };

    $("#cancelBox").onclick = closeBoxModal;

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
}

