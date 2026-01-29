const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

const views = {
  profile: document.getElementById("view-profile"),
  tournaments: document.getElementById("view-tournaments"),
};

// 메뉴 열기/닫기
function closeMenu() {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
}

menuBtn.addEventListener("click", () => {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
});

overlay.addEventListener("click", closeMenu);

// 메뉴 클릭 → 화면 전환
sideMenu.addEventListener("click", e => {
  const item = e.target.closest("li[data-view]");
  if (!item) return;

  const view = item.dataset.view;

  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[view].classList.remove("hidden");

  closeMenu();
});

// 기본 화면 = 대회 목록
Object.values(views).forEach(v => v.classList.add("hidden"));
views.tournaments.classList.remove("hidden");

// (임시) 프로필 저장
document.getElementById("saveProfileBtn").addEventListener("click", () => {
  const nickname = document.getElementById("nicknameInput").value;
  const mode = document.querySelector("input[name='displayMode']:checked").value;

  console.log("SAVE PROFILE", { nickname, mode });
});
document.querySelectorAll(".tournament-row").forEach(card => {
  card.addEventListener("click", () => {
    const tournamentId = card.dataset.id;

    // 👉 나중에 index.html?tournamentId=xxx 로 연결
    console.log("ENTER TOURNAMENT:", tournamentId);

    // location.href = `index.html?tournamentId=${tournamentId}`;
  });
});
