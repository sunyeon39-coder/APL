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
import { getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let currentUserRole = "user";   // user | admin
let tournaments = [];
let authReady = false;

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
   AUTH (🔥 핵심)
=============================== */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  currentUser = user;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists() && snap.data().role === "admin") {
      currentUserRole = "admin";
      document.body.classList.add("admin");
    } else {
      currentUserRole = "user";
      document.body.classList.remove("admin");
    }

    authReady = true;
    renderTournaments();

  } catch (e) {
    console.error("🔥 role fetch error", e);
  }
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
  if (!authReady) return;

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
      ${currentUserRole === "admin" ? `
        <button class="more-btn">⋮</button>
        <div class="action-menu hidden">
          <button class="delete-action danger">삭제</button>
        </div>
      ` : ""}

      <h3>${t.name}</h3>
      <div class="location">${t.location || ""}</div>
      <div class="date">${formatDateRange(t.start, t.end)}</div>
    `;

    // 카드 클릭 → 상세 이동
    row.addEventListener("click", () => {
      location.href = `index.html?eventId=${t.id}`;
    });

    if (currentUserRole === "admin") {
      const moreBtn = row.querySelector(".more-btn");
      const menu = row.querySelector(".action-menu");
      const deleteBtn = row.querySelector(".delete-action");

      moreBtn.addEventListener("click", e => {
        e.stopPropagation();
        document.querySelectorAll(".action-menu").forEach(m => m.classList.add("hidden"));
        menu.classList.toggle("hidden");
      });

      deleteBtn.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm("이 대회를 삭제할까요?")) return;
        await deleteDoc(doc(db, "events", t.id));
      });
    }

    tournamentListEl.appendChild(row);
  });

  // 메뉴 외부 클릭 시 닫기
  document.addEventListener("click", () => {
    document.querySelectorAll(".action-menu").forEach(m => m.classList.add("hidden"));
  }, { once:true });
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

      renderTournaments();
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
