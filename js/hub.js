import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const eventListEl = $("eventList");
const logoutBtn = $("logoutBtn");
const profileBtn = $("profileBtn");
const adminBtn = $("adminBtn");

const profileModal = $("profileModal");
const closeProfileBtn = $("closeProfileBtn");
const saveProfileBtn = $("saveProfileBtn");

const profileEmail = $("profileEmail");
const profileNickname = $("profileNickname");
const profileAccessCode = $("profileAccessCode");

const adminModal = $("adminModal");
const closeAdminBtn = $("closeAdminBtn");

const adminEventSelect = $("adminEventSelect");
const adminSearchInput = $("adminSearchInput");

const adminTournamentId = $("adminTournamentId");
const adminTournamentName = $("adminTournamentName");
const adminTournamentStartDate = $("adminTournamentStartDate");
const adminTournamentEndDate = $("adminTournamentEndDate");
const adminTournamentLogoText = $("adminTournamentLogoText");
const adminEventCode = $("adminEventCode");

const newTournamentBtn = $("newTournamentBtn");
const saveTournamentBtn = $("saveTournamentBtn");
const deleteTournamentBtn = $("deleteTournamentBtn");

const adminUserList = $("adminUserList");

let currentUser = null;
let currentUserProfile = null;
let tournamentsCache = [];
let usersCache = [];

const fallbackTournaments = [
  {
    id: "ept-paris-2026",
    name: "EPT Paris 2026",
    startDate: "26.02.18",
    endDate: "26.03.01",
    logoText: "EPT",
    requiredCode: "EPT2026A"
  }
];

/* ===============================
   LOCAL STORAGE KEYS (layout.js와 동일)
=============================== */
const GLOBAL_WAITING_KEY = "boxboard_waiting_global_v2";

/* ===============================
   HELPERS
=============================== */
function openModal(el) {
  el.classList.add("show");
}

function closeModal(el) {
  el.classList.remove("show");
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadGlobalWaitingState() {
  const raw = localStorage.getItem(GLOBAL_WAITING_KEY);
  const parsed = raw ? safeParse(raw) : null;

  if (!parsed || typeof parsed !== "object") {
    return {
      version: 2,
      waiting: [],
      updatedAt: Date.now()
    };
  }

  if (!Array.isArray(parsed.waiting)) {
    parsed.waiting = [];
  }

  return parsed;
}

function saveGlobalWaitingState(state) {
  try {
    localStorage.setItem(GLOBAL_WAITING_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("saveGlobalWaitingState error:", err);
  }
}

function hasEventAccess(userProfile, tournament) {
  if (!userProfile) return false;
  if (userProfile.role === "admin") return true;

  const allowedEvents = userProfile.allowedEvents || {};
  if (allowedEvents[tournament.id] === true) return true;

  const userCode = (userProfile.accessCode || "").trim();
  const requiredCode = (tournament.requiredCode || "").trim();

  if (userCode && requiredCode && userCode === requiredCode) return true;

  return false;
}

function getSelectedTournament() {
  const selectedId = adminEventSelect.value;
  return tournamentsCache.find((t) => t.id === selectedId) || null;
}

function userStillHasAccessToSelectedEvent(user) {
  const tournament = getSelectedTournament();
  if (!user || !tournament) return false;
  return hasEventAccess(user, tournament);
}

/* ===============================
   WAITING / SEAT CLEANUP
=============================== */
function removeUserFromGlobalWaiting(user) {
  if (!user) return 0;

  const waitingState = loadGlobalWaitingState();
  const before = waitingState.waiting.length;

  const targetUid = String(user.uid || "").trim();
  const targetName = String(user.nickname || "").trim();

  waitingState.waiting = waitingState.waiting.filter((item) => {
    if (!item || typeof item !== "object") return false;

    const itemUid = String(item.uid || "").trim();
    const itemName = String(item.name || "").trim();

    if (targetUid && itemUid && itemUid === targetUid) {
      return false;
    }

    if (targetName && itemName === targetName) {
      return false;
    }

    return true;
  });

  const removedCount = before - waitingState.waiting.length;

  if (removedCount > 0) {
    waitingState.updatedAt = Date.now();
    saveGlobalWaitingState(waitingState);
  }

  return removedCount;
}

function removeUserFromAllSeats(user) {
  if (!user) return 0;

  const targetName = String(user.nickname || "").trim();
  if (!targetName) return 0;

  let removedCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!key.startsWith("boxboard_event_")) continue;
    if (!key.endsWith("_v2")) continue;

    const raw = localStorage.getItem(key);
    const parsed = raw ? safeParse(raw) : null;

    if (!parsed || !Array.isArray(parsed.seats)) continue;

    let changed = false;

    parsed.seats = parsed.seats.map((seat) => {
      if (!seat || typeof seat !== "object") return seat;

      const person = String(seat.person || "").trim();

      if (!person || person === "비어있음") return seat;
      if (person !== targetName) return seat;

      removedCount += 1;
      changed = true;

      return {
        ...seat,
        person: "비어있음",
        seatedAt: null
      };
    });

    if (changed) {
      parsed.updatedAt = Date.now();
      try {
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch (err) {
        console.error("removeUserFromAllSeats save error:", err);
      }
    }
  }

  return removedCount;
}

function cleanupUserFromLayoutState(user) {
  const waitingRemoved = removeUserFromGlobalWaiting(user);
  const seatRemoved = removeUserFromAllSeats(user);

  return {
    waitingRemoved,
    seatRemoved
  };
}

/* ===============================
   TOURNAMENT RENDER
=============================== */
function renderTournaments(tournaments, userProfile) {
  eventListEl.innerHTML = "";

  tournaments.forEach((tournament) => {
    const enabled = hasEventAccess(userProfile, tournament);

    const card = document.createElement("article");
    card.className = `event-card ${enabled ? "is-enabled" : "is-locked"}`;
    card.dataset.eventId = tournament.id;

    card.innerHTML = `
      <div class="event-left">${escapeHtml(tournament.logoText || "HAN")}</div>

      <div class="event-center">
        <h2 class="event-title">${escapeHtml(tournament.name)}</h2>
        <div class="event-date">
          ${escapeHtml(tournament.startDate)} ~ ${escapeHtml(tournament.endDate)}
        </div>
        <div class="event-access">
          ${enabled ? "접속 가능" : "허용된 계정만 입장 가능"}
        </div>
      </div>

      <div class="event-right">
        ${
          enabled
            ? `<button class="detail-btn" type="button">자세히 보기 →</button>`
            : `<div class="lock-badge">접근 제한</div>`
        }
      </div>
    `;

    if (enabled) {
      card.addEventListener("click", () => {
        location.href = `./index.html?eventId=${encodeURIComponent(tournament.id)}`;
      });
    }

    eventListEl.appendChild(card);
  });
}

/* ===============================
   LOADERS
=============================== */
async function loadTournaments() {
  try {
    const snap = await getDocs(collection(db, "tournaments"));

    if (snap.empty) {
      tournamentsCache = fallbackTournaments;
      return tournamentsCache;
    }

    tournamentsCache = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        name: data.name || d.id,
        startDate: data.startDate || "",
        endDate: data.endDate || "",
        logoText: data.logoText || "HAN",
        requiredCode: data.requiredCode || ""
      };
    });

    return tournamentsCache;
  } catch (err) {
    console.error("loadTournaments error:", err);
    tournamentsCache = fallbackTournaments;
    return tournamentsCache;
  }
}

async function loadAllUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));

    usersCache = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        uid: d.id,
        nickname: data.nickname || "",
        email: data.email || "",
        role: data.role || "user",
        accessCode: data.accessCode || "",
        allowedEvents: data.allowedEvents || {}
      };
    });

    return usersCache;
  } catch (err) {
    console.error("loadAllUsers error:", err);
    usersCache = [];
    return usersCache;
  }
}

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

/* ===============================
   ADMIN TOURNAMENT FORM
=============================== */
function populateTournamentSelect() {
  adminEventSelect.innerHTML = tournamentsCache
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
    .join("");

  if (tournamentsCache.length) {
    adminEventSelect.value = tournamentsCache[0].id;
    syncSelectedTournamentForm();
  } else {
    resetTournamentForm();
  }
}

function syncSelectedTournamentForm() {
  const selectedId = adminEventSelect.value;
  const tournament = tournamentsCache.find((t) => t.id === selectedId);

  if (!tournament) {
    resetTournamentForm();
    return;
  }

  adminTournamentId.value = tournament.id || "";
  adminTournamentName.value = tournament.name || "";
  adminTournamentStartDate.value = tournament.startDate || "";
  adminTournamentEndDate.value = tournament.endDate || "";
  adminTournamentLogoText.value = tournament.logoText || "";
  adminEventCode.value = tournament.requiredCode || "";
}

function resetTournamentForm() {
  adminTournamentId.value = "";
  adminTournamentName.value = "";
  adminTournamentStartDate.value = "";
  adminTournamentEndDate.value = "";
  adminTournamentLogoText.value = "";
  adminEventCode.value = "";
}

/* ===============================
   ADMIN USER LIST
=============================== */
function getFilteredUsers() {
  const keyword = adminSearchInput.value.trim().toLowerCase();
  if (!keyword) return usersCache;

  return usersCache.filter((user) => {
    const nickname = (user.nickname || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    return nickname.includes(keyword) || email.includes(keyword);
  });
}

function renderAdminUserList() {
  const selectedEventId = adminEventSelect.value;
  const selectedTournament = tournamentsCache.find((t) => t.id === selectedEventId);
  const users = getFilteredUsers();

  if (!users.length) {
    adminUserList.innerHTML = `<div class="empty-users">표시할 유저가 없습니다.</div>`;
    return;
  }

  adminUserList.innerHTML = users.map((user) => {
    const directAllowed = user.allowedEvents?.[selectedEventId] === true;
    const codeMatched =
      !!user.accessCode &&
      !!selectedTournament?.requiredCode &&
      user.accessCode === selectedTournament.requiredCode;

    return `
      <div class="user-row" data-uid="${escapeHtml(user.uid)}">
        <div class="user-main">
          <div class="user-name">${escapeHtml(user.nickname || "이름 없음")}</div>
          <div class="user-email">${escapeHtml(user.email || user.uid)}</div>
          <div class="user-meta">
            <span class="meta-pill">${escapeHtml(user.role)}</span>
            <span class="meta-pill">${escapeHtml(user.accessCode || "코드 없음")}</span>
            <span class="meta-pill ${directAllowed ? "ok" : "lock"}">
              ${directAllowed ? "직접 허용됨" : "직접 허용 없음"}
            </span>
            <span class="meta-pill ${codeMatched ? "ok" : "lock"}">
              ${codeMatched ? "코드 일치" : "코드 불일치"}
            </span>
          </div>
        </div>

        <div class="user-actions">
          <button class="row-btn allow" type="button" data-action="allow" data-uid="${escapeHtml(user.uid)}">직접 허용</button>
          <button class="row-btn revoke" type="button" data-action="revoke" data-uid="${escapeHtml(user.uid)}">허용 해제</button>
          <button class="row-btn assign" type="button" data-action="assignCode" data-uid="${escapeHtml(user.uid)}">코드 부여</button>
          <button class="row-btn remove-code" type="button" data-action="removeCode" data-uid="${escapeHtml(user.uid)}">코드 제거</button>
          <button class="row-btn view" type="button" data-action="viewCode" data-uid="${escapeHtml(user.uid)}">코드 보기</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ===============================
   PROFILE
=============================== */
async function saveNickname() {
  if (!currentUser) return;

  const nickname = profileNickname.value.trim();

  if (nickname.length < 2 || nickname.length > 7) {
    alert("닉네임은 2~7자로 입력해주세요.");
    return;
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid), { nickname });

    if (currentUserProfile) {
      currentUserProfile.nickname = nickname;
    }

    const cacheUser = usersCache.find((u) => u.uid === currentUser.uid);
    if (cacheUser) {
      cacheUser.nickname = nickname;
    }

    alert("닉네임이 저장되었습니다.");
    closeModal(profileModal);
    renderAdminUserList();
  } catch (err) {
    console.error(err);
    alert("닉네임 저장에 실패했습니다.");
  }
}

/* ===============================
   TOURNAMENT CRUD
=============================== */
async function saveTournament() {
  if (currentUserProfile?.role !== "admin") return;

  const id = adminTournamentId.value.trim();
  const name = adminTournamentName.value.trim();
  const startDate = adminTournamentStartDate.value.trim();
  const endDate = adminTournamentEndDate.value.trim();
  const logoText = adminTournamentLogoText.value.trim();
  const requiredCode = adminEventCode.value.trim();

  if (!id || !name) {
    alert("대회 ID와 대회명을 입력해주세요.");
    return;
  }

  try {
    await setDoc(
      doc(db, "tournaments", id),
      { name, startDate, endDate, logoText, requiredCode },
      { merge: true }
    );

    tournamentsCache = await loadTournaments();
    populateTournamentSelect();
    adminEventSelect.value = id;
    syncSelectedTournamentForm();
    renderAdminUserList();
    renderTournaments(tournamentsCache, currentUserProfile);

    alert("대회가 저장되었습니다.");
  } catch (err) {
    console.error(err);
    alert("대회 저장에 실패했습니다.");
  }
}

async function deleteTournamentCurrent() {
  if (currentUserProfile?.role !== "admin") return;

  const id = adminTournamentId.value.trim();
  if (!id) {
    alert("삭제할 대회가 없습니다.");
    return;
  }

  const ok = confirm(`"${id}" 대회를 삭제할까요?`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "tournaments", id));

    tournamentsCache = await loadTournaments();
    populateTournamentSelect();
    renderAdminUserList();
    renderTournaments(tournamentsCache, currentUserProfile);

    alert("대회가 삭제되었습니다.");
  } catch (err) {
    console.error(err);
    alert("대회 삭제에 실패했습니다.");
  }
}

/* ===============================
   ACCESS / CODE ACTIONS
=============================== */
async function grantEventDirectly(uid, eventId) {
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        allowedEvents: {
          [eventId]: true
        }
      },
      { merge: true }
    );

    const user = usersCache.find((u) => u.uid === uid);
    if (user) {
      user.allowedEvents = {
        ...(user.allowedEvents || {}),
        [eventId]: true
      };
    }

    renderAdminUserList();
    alert("직접 허용이 저장되었습니다.");
  } catch (err) {
    console.error(err);
    alert("직접 허용 저장에 실패했습니다.");
  }
}

async function revokeEventDirectly(uid, eventId) {
  try {
    await updateDoc(doc(db, "users", uid), {
      [`allowedEvents.${eventId}`]: deleteField()
    });

    const user = usersCache.find((u) => u.uid === uid);
    if (user?.allowedEvents) {
      delete user.allowedEvents[eventId];
    }

    let cleaned = { waitingRemoved: 0, seatRemoved: 0 };

    if (user && !userStillHasAccessToSelectedEvent(user)) {
      cleaned = cleanupUserFromLayoutState(user);
    }

    renderAdminUserList();

    if (cleaned.waitingRemoved > 0 || cleaned.seatRemoved > 0) {
      alert(
        `직접 허용이 해제되었고, 대기 ${cleaned.waitingRemoved}건 / 좌석 ${cleaned.seatRemoved}건 정리되었습니다.`
      );
    } else {
      alert("직접 허용이 해제되었습니다.");
    }
  } catch (err) {
    console.error(err);
    alert("허용 해제에 실패했습니다.");
  }
}

async function assignEventCodeToUser(uid, eventId) {
  try {
    const tournament = tournamentsCache.find((t) => t.id === eventId);
    const requiredCode = (tournament?.requiredCode || "").trim();

    if (!requiredCode) {
      alert("선택한 대회에 설정된 코드가 없습니다.");
      return;
    }

    await updateDoc(doc(db, "users", uid), {
      accessCode: requiredCode
    });

    const user = usersCache.find((u) => u.uid === uid);
    if (user) {
      user.accessCode = requiredCode;
    }

    renderAdminUserList();
    alert(`유저 코드가 부여되었습니다: ${requiredCode}`);
  } catch (err) {
    console.error(err);
    alert("유저 코드 부여에 실패했습니다.");
  }
}

async function removeUserCode(uid) {
  try {
    await updateDoc(doc(db, "users", uid), {
      accessCode: ""
    });

    const user = usersCache.find((u) => u.uid === uid);
    if (user) {
      user.accessCode = "";
    }

    let cleaned = { waitingRemoved: 0, seatRemoved: 0 };

    if (user && !userStillHasAccessToSelectedEvent(user)) {
      cleaned = cleanupUserFromLayoutState(user);
    }

    renderAdminUserList();

    if (cleaned.waitingRemoved > 0 || cleaned.seatRemoved > 0) {
      alert(
        `유저 코드가 제거되었고, 대기 ${cleaned.waitingRemoved}건 / 좌석 ${cleaned.seatRemoved}건 정리되었습니다.`
      );
    } else {
      alert("유저 코드가 제거되었습니다.");
    }
  } catch (err) {
    console.error(err);
    alert("유저 코드 제거에 실패했습니다.");
  }
}

function showUserCode(uid) {
  const user = usersCache.find((u) => u.uid === uid);
  if (!user) return;

  alert(`${user.nickname || "이름 없음"}\n접근 코드: ${user.accessCode || "없음"}`);
}

/* ===============================
   EVENTS
=============================== */
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.href = "./login.html";
  } catch (err) {
    console.error(err);
    alert("로그아웃에 실패했습니다.");
  }
});

profileBtn.addEventListener("click", () => {
  if (!currentUser || !currentUserProfile) return;

  profileEmail.value = currentUser.email || "";
  profileNickname.value = currentUserProfile.nickname || "";
  profileAccessCode.value = currentUserProfile.accessCode || "";
  openModal(profileModal);
});

adminBtn.addEventListener("click", async () => {
  if (currentUserProfile?.role !== "admin") return;

  if (!tournamentsCache.length) {
    await loadTournaments();
  }
  if (!usersCache.length) {
    await loadAllUsers();
  }

  populateTournamentSelect();
  renderAdminUserList();
  openModal(adminModal);
});

closeProfileBtn.addEventListener("click", () => closeModal(profileModal));
saveProfileBtn.addEventListener("click", saveNickname);

closeAdminBtn.addEventListener("click", () => closeModal(adminModal));

newTournamentBtn.addEventListener("click", () => {
  resetTournamentForm();
  adminTournamentId.focus();
});

saveTournamentBtn.addEventListener("click", saveTournament);
deleteTournamentBtn.addEventListener("click", deleteTournamentCurrent);

adminEventSelect.addEventListener("change", () => {
  syncSelectedTournamentForm();
  renderAdminUserList();
});

adminSearchInput.addEventListener("input", renderAdminUserList);

adminUserList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const uid = btn.dataset.uid;
  const eventId = adminEventSelect.value;

  if (!uid || !eventId) return;

  if (action === "allow") return grantEventDirectly(uid, eventId);
  if (action === "revoke") return revokeEventDirectly(uid, eventId);
  if (action === "assignCode") return assignEventCodeToUser(uid, eventId);
  if (action === "removeCode") return removeUserCode(uid);
  if (action === "viewCode") return showUserCode(uid);
});

profileModal.addEventListener("click", (e) => {
  if (e.target === profileModal) closeModal(profileModal);
});

adminModal.addEventListener("click", (e) => {
  if (e.target === adminModal) closeModal(adminModal);
});

/* ===============================
   AUTH INIT
=============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("./login.html");
    return;
  }

  currentUser = user;

  try {
    currentUserProfile = await loadUserProfile(user.uid);
    tournamentsCache = await loadTournaments();

    if (currentUserProfile?.role === "admin") {
      usersCache = await loadAllUsers();
      adminBtn.classList.remove("hidden");
    } else {
      adminBtn.classList.add("hidden");
    }

    renderTournaments(tournamentsCache, currentUserProfile);
  } catch (err) {
    console.error(err);
    alert("허브 데이터를 불러오지 못했습니다.");
  }
});