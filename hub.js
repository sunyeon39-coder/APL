import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const userManageBtn = document.getElementById("userManageBtn");

/* profile */
const profileArea = document.getElementById("profileArea");
const profileImg = document.getElementById("profileImg");
const profileName = document.getElementById("profileName");

/* nickname modal */
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const nicknameSaveBtn = document.getElementById("nicknameSaveBtn");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let currentUserRole = "user";
let tournaments = [];
let authReady = false;
let unsubscribeEvents = null;

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

userManageBtn?.addEventListener("click", () => {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
  location.href = "/admin/users.html";
});

/* ===============================
   AUTH (🔥 핵심)
=============================== */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  currentUser = user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    console.warn("❌ users 문서 없음");
    return;
  }

  const u = snap.data();
  currentUserRole = u.role || "user";
  document.body.classList.toggle("admin", currentUserRole === "admin");

  /* 프로필 표시 */
  profileImg.src = u.photoURL || user.photoURL || "https://via.placeholder.com/40";
  profileName.textContent = u.nickname || u.name || u.email;
  profileArea?.classList.remove("hidden");

  /* 닉네임 없으면 모달 */
  if (!u.nickname) {
    nicknameModal?.classList.remove("hidden");
  }

  authReady = true;

  startEventsListener();
});

/* ===============================
   EVENTS LISTENER (Auth 이후)
=============================== */
function startEventsListener() {
  if (unsubscribeEvents) return;

  unsubscribeEvents = onSnapshot(
    query(collection(db, "events"), orderBy("createdAt", "desc")),
    snap => {
      tournaments = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      renderTournaments();
    },
    err => {
      console.error("🔥 events snapshot error", err);
    }
  );
}

/* ===============================
   NICKNAME SAVE
=============================== */
nicknameSaveBtn?.addEventListener("click", async () => {
  const val = nicknameInput.value.trim();
  if (!val) return alert("닉네임을 입력하세요");

  await updateDoc(doc(db, "users", currentUser.uid), {
    nickname: val
  });

  profileName.textContent = val;
  nicknameModal.classList.add("hidden");
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

    row.addEventListener("click", () => {
      location.href = `index.html?eventId=${t.id}`;
    });

    if (currentUserRole === "admin") {
      const moreBtn = row.querySelector(".more-btn");
      const menu = row.querySelector(".action-menu");
      const deleteBtn = row.querySelector(".delete-action");

      moreBtn.addEventListener("click", e => {
        e.stopPropagation();
        document.querySelectorAll(".action-menu")
          .forEach(m => m.classList.add("hidden"));
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
    document.querySelectorAll(".action-menu")
      .forEach(m => m.classList.add("hidden"));
  }, { once: true });
}

/* ===============================
   EVENT CREATE MODAL
=============================== */
createEventBtn?.addEventListener("click", () => {
  eventModal.classList.remove("hidden");
});

eventCancelBtn?.addEventListener("click", () => {
  eventModal.classList.add("hidden");
});

eventSaveBtn?.addEventListener("click", async () => {
  if (!eventName.value.trim()) {
    alert("대회명을 입력하세요");
    return;
  }

  await addDoc(collection(db, "events"), {
    name: eventName.value,
    location: eventLocation.value,
    start: eventStart.value,
    end: eventEnd.value,
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid
  });

  eventName.value = "";
  eventLocation.value = "";
  eventStart.value = "";
  eventEnd.value = "";
  eventModal.classList.add("hidden");
});
