// hub.js — FINAL (LOOP FIXED / FUNCTIONS SAFE)
// ✅ 변경 포인트(기능/UX/UI 유지, 오류만 수정):
// 1) 모바일 redirect 로그인 후 users/{uid} 문서가 아직 없을 때
//    hub에서 다시 login으로 튕기며 무한 루프가 발생할 수 있음 → hub에서 자동 생성(merge)로 해결
// 2) Firestore 권한/네트워크 에러가 나도 전체 기능이 "멈춘 것처럼" 보이지 않도록 콘솔 로그 + 최소 방어

import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
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
const profileBtn = document.getElementById("profileBtn");
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
   UTIL (MENU)
=============================== */
function openMenu() {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
}
function closeMenu() {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
}

/* ===============================
   MENU
=============================== */
menuBtn?.addEventListener("click", openMenu);
overlay?.addEventListener("click", closeMenu);

userManageBtn?.addEventListener("click", () => {
  closeMenu();
  location.href = "/admin/users.html";
});

/* ===============================
   PROFILE
=============================== */
function openProfile() {
  closeMenu();
  nicknameModal.classList.remove("hidden");
}
profileArea?.addEventListener("click", openProfile);
profileBtn?.addEventListener("click", openProfile);

/* ===============================
   🔥 USERS DOC ENSURE (핵심)
=============================== */
async function ensureUserDocFromHub(user) {
  const userRef = doc(db, "users", user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (e) {
    console.error("❌ hub: users getDoc failed:", e);
    // 권한 문제면 여기서 더 진행해도 기능이 안 되므로 login으로 보내지 말고,
    // 콘솔을 남기고 화면은 유지(사용자가 devtools로 확인 가능)
    throw e;
  }

  if (snap.exists()) return snap.data();

  // ✅ 여기서 바로 생성 (루프 방지)
  const data = {
    email: user.email || "",
    nickname: user.displayName || (user.email ? user.email.split("@")[0] : "user"),
    photoURL: user.photoURL || "",
    role: "user",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, data, { merge: true });
  } catch (e) {
    console.error("❌ hub: users setDoc failed:", e);
    throw e;
  }

  // merge 후 UI 반영용으로 반환
  return data;
}

/* ===============================
   🔥 AUTH GATE
=============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("login.html");
    return;
  }

  currentUser = user;

  let u;
  try {
    u = await ensureUserDocFromHub(user);
  } catch (e) {
    // 여기서 강제 리다이렉트하면 사용자 입장에선 "허브가 먹통/무한루프"처럼 보임
    // 화면은 유지하고, 최소 안내만.
    console.warn("⚠️ hub auth ready failed:", e);
    tournamentEmptyEl && (tournamentEmptyEl.style.display = "block");
    return;
  }

  // 혹시 서버에 role/nickname이 이미 있다면 최신값 다시 읽기 시도(실패해도 계속 진행)
  try {
    const snap2 = await getDoc(doc(db, "users", user.uid));
    if (snap2.exists()) u = snap2.data();
  } catch (e) {}

  currentUserRole = u.role || "user";
  document.body.classList.toggle("admin", currentUserRole === "admin");

  /* 프로필 표시 */
  if (profileImg) {
    profileImg.src = u.photoURL || user.photoURL || "https://via.placeholder.com/40";
  }
  if (profileName) {
    profileName.textContent = u.nickname || u.name || u.email || user.email || "내 프로필";
  }

  profileArea?.classList.remove("hidden");

  /* 닉네임 없으면 강제 설정 */
  if (!u.nickname) {
    nicknameModal.classList.remove("hidden");
  }

  authReady = true;
  startEventsListener();
});

/* ===============================
   EVENTS LISTENER
=============================== */
function startEventsListener() {
  if (unsubscribeEvents) return;

  unsubscribeEvents = onSnapshot(
    query(collection(db, "events"), orderBy("createdAt", "desc")),
    (snap) => {
      tournaments = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      renderTournaments();
    },
    (err) => {
      console.error("🔥 events snapshot error", err);
      // 권한/네트워크 오류 시, 최소한 빈 상태 UI는 보여줌
      renderTournaments();
    }
  );
}

/* ===============================
   NICKNAME SAVE
=============================== */
nicknameSaveBtn?.addEventListener("click", async () => {
  const val = nicknameInput.value.trim();
  if (!val) {
    alert("닉네임을 입력하세요");
    return;
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid), { nickname: val });
  } catch (e) {
    console.error("❌ nickname update failed:", e);
    alert("닉네임 저장에 실패했습니다.");
    return;
  }

  if (profileName) profileName.textContent = val;
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

  if (!tournaments || tournaments.length === 0) {
    tournamentEmptyEl.style.display = "block";
    return;
  }

  tournamentEmptyEl.style.display = "none";

  tournaments.forEach((t) => {
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

      moreBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".action-menu").forEach((m) => m.classList.add("hidden"));
        menu?.classList.toggle("hidden");
      });

      deleteBtn?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("이 대회를 삭제할까요?")) return;
        try {
          await deleteDoc(doc(db, "events", t.id));
        } catch (err) {
          console.error("❌ delete event failed:", err);
          alert("삭제에 실패했습니다.");
        }
      });
    }

    tournamentListEl.appendChild(row);
  });

  // 기존 동작 유지: 바깥 클릭 시 메뉴 닫기 (한 번만)
  document.addEventListener(
    "click",
    () => {
      document.querySelectorAll(".action-menu").forEach((m) => m.classList.add("hidden"));
    },
    { once: true }
  );
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

  try {
    await addDoc(collection(db, "events"), {
      name: eventName.value,
      location: eventLocation.value,
      start: eventStart.value,
      end: eventEnd.value,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
    });
  } catch (e) {
    console.error("❌ create event failed:", e);
    alert("대회 생성에 실패했습니다.");
    return;
  }

  eventName.value = "";
  eventLocation.value = "";
  eventStart.value = "";
  eventEnd.value = "";
  eventModal.classList.add("hidden");
});
