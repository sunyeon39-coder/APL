// app.js — CLICK SAFE + CARD NAV (minimal, non-destructive)

function getEventId(){
  const params = new URLSearchParams(location.search);
  return params.get("eventId") || sessionStorage.getItem("eventId") || "";
}

function safeUnblockClicks(){
  try{
    document.documentElement.classList.remove("page-enter");
    document.documentElement.classList.add("page-ready");
    document.body.style.pointerEvents = "auto";
  }catch(e){}

  // hidden overlay는 클릭 차단 해제
  try{
    const blockers = document.querySelectorAll(
      ".overlay, .loading, .blocker, .page-block, .modal-block, .layout-loading"
    );
    blockers.forEach(el => {
      const cs = getComputedStyle(el);
      const isHidden =
        el.classList.contains("hidden") ||
        el.getAttribute("aria-hidden") === "true" ||
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        cs.opacity === "0";
      if (isHidden){
        el.style.pointerEvents = "none";
      }
    });
  }catch(e){}
}

function getBoxIdFromCard(card){
  if (!card) return "";
  return (
    card.dataset.boxId ||
    card.dataset.boxid ||
    card.getAttribute("data-box-id") ||
    ""
  );
}

function goLayout(boxId){
  const eventId = getEventId();
  const url =
    `layout_index.html?boxId=${encodeURIComponent(boxId)}` +
    (eventId ? `&eventId=${encodeURIComponent(eventId)}` : "");
  location.href = url;
}

document.addEventListener("DOMContentLoaded", () => {
  safeUnblockClicks();

  // 🔥 카드 클릭 → layout 이동
  document.addEventListener("click", (e) => {
    if (e.target.closest(".hover-btn")) return;

    const card = e.target.closest(".card");
    if (!card) return;

    const boxId = getBoxIdFromCard(card);
    if (!boxId) return;

    goLayout(boxId);
  }, true); // capture
});

window.addEventListener("focus", safeUnblockClicks);
window.addEventListener("pageshow", safeUnblockClicks);
