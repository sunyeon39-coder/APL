import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM
=============================== */
const tournamentListEl = document.getElementById("tournamentList");
const tournamentEmptyEl = document.getElementById("tournamentEmpty");
const createEventBtn = document.getElementById("createEventBtn");

const eventModal = document.getElementById("eventModal");
const eventName = document.getElementById("eventName");
const eventLocation = document.getElementById("eventLocation");
const eventStart = document.getElementById("eventStart");
const eventEnd = document.getElementById("eventEnd");
const eventSaveBtn = document.getElementById("eventSaveBtn");
const eventCancelBtn = document.getElementById("eventCancelBtn");

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const profileBtn = document.getElementById("profileBtn");

/* ===============================
   SAFE INIT
=============================== */
sideMenu?.classList.remove("open");
overlay?.classList.remove("show");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let currentUserRole = "user";
let tournaments = [];
let authReady = false;   // 🔥 핵심 플래그

/* ===============================
   MENU
=============================== */
menuBtn?.addEventListener("click", () => {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
});

overlay?.addEventListener("click", () => {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
});

/* ===============================
   PROFILE
=============================== */
profileBtn?.addEventListener("click", () => {
  location.href = "profile.html";
});

/* ===============================
   AUTH
=============================== */
onAuthStateChanged(auth, user => {
  if (!user) return;

  currentUser = user;
  currentUserRole = user.email?.includes("admin") ? "admin" : "user";

  document.body.classList.toggle("admin", currentUserRole === "admin");

  authReady = true;

  // 🔥 AUTH 확정 후 재렌더
  renderTournaments();
});

/* ===============================
   UTIL
=============================== */
function formatDateRange(start, end) {
  if (!start || !end) return "";
  return `${start} ~ ${end}`;
}

/* ===============================
   RENDER
=============================== */
function renderTournaments() {
  if (!authReady) return; // 🔥 AUTH 전엔 렌더 금지
  if (!tournamentListEl || !tournamentEmptyEl) return;

  tournamentListEl.innerHTML = "";

  if (tournaments.length === 0) {
    tournamentEmptyEl.style.display = "block";
    return;
  }

  tournamentEmptyEl.style.display = "none";

  tournaments.forEach(t => {
    const row = document.createElement("div");
    row.className = "tournament-row";

    row.innerHTML = `
      ${currentUserRole === "admin"
        ? `<button class="delete-btn">✕</button>`
        : ""
      }
      <h3>${t.name}</h3>
      <div class="location">${t.location || ""}</div>
      <div class="date">${formatDateRange(t.start, t.end)}</div>
    `;

    row.addEventListener("click", () => {
      location.href = `index.html?eventId=${t.id}`;
    });

    if (currentUserRole === "admin") {
      const delBtn = row.querySelector(".delete-btn");
      delBtn.addEventListener("click", async e => {
        e.stopPropagation();

        if (!confirm("이 대회를 삭제할까요?")) return;

        try {
          await deleteDoc(doc(db, "events", t.id));
        } catch (err) {
          console.error("🔥 delete error", err);
          alert("삭제 실패");
        }
      });
    }

    tournamentListEl.appendChild(row);
  });
}

/* ===============================
   FIRESTORE
=============================== */
try {
  const eventsRef = collection(db, "events");

  onSnapshot(
    query(eventsRef, orderBy("createdAt", "desc")),
    snap => {
      tournaments = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderTournaments(); // 🔥 authReady 체크 포함
    },
    err => console.error("🔥 snapshot error", err)
  );
} catch (e) {
  console.error("🔥 firestore init error", e);
}

/* ===============================
   MODAL
=============================== */
createEventBtn?.addEventListener("click", () => {
  eventModal?.classList.remove("hidden");
});

eventCancelBtn?.addEventListener("click", () => {
  eventModal?.classList.add("hidden");
});

eventSaveBtn?.addEventListener("click", async () => {
  if (!eventName.value.trim()) {
    alert("대회명을 입력하세요");
    return;
  }

  try {
    await addDoc(collection(db, "events"), {
      name: eventName.value,
      location: eventLocation.value,
      start: eventStart.value,
      end: eventEnd.value,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.uid || "temp"
    });

    eventName.value = "";
    eventLocation.value = "";
    eventStart.value = "";
    eventEnd.value = "";

    eventModal.classList.add("hidden");
  } catch (e) {
    console.error("🔥 add event error", e);
    alert("대회 생성 실패");
  }
});
