// hub.js (minimal placeholder)
// 원본 기능이 따로 있으면 이 파일을 대체하지 말고, 이 코드는 '없어서 깨지는' 경우만 막는 용도
console.log("hub.js loaded (minimal)");

// Side menu toggle
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

function openMenu(){
  sideMenu?.classList.add("open");
  overlay?.classList.add("show");
}
function closeMenu(){
  sideMenu?.classList.remove("open");
  overlay?.classList.remove("show");
}

menuBtn?.addEventListener("click", () => {
  if (sideMenu?.classList.contains("open")) closeMenu();
  else openMenu();
});
overlay?.addEventListener("click", closeMenu);
