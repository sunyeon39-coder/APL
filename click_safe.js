// click_safe.js — CLICK SAFE + CARD NAV (NON-DESTRUCTIVE PATCH)

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
    card.getAttribute("data-box-id") ||
    ""
  );
}

function goLayout(boxId){
  const eventId = getEventId();
  location.href =
    `layout_index.html?boxId=${encodeURIComponent(boxId)}` +
    (eventId ? `&eventId=${encodeURIComponent(eventId)}` : "");
}

document.addEventListener("DOMContentLoaded", () => {
  safeUnblockClicks();

  // 카드 클릭만 가로채고, 나머지는 기존 app.js 그대로 둠
  document.addEventListener("click", (e) => {
    if (e.target.closest(".hover-btn")) return;

    const card = e.target.closest(".card");
    if (!card) return;

    const boxId = getBoxIdFromCard(card);
    if (!boxId) return;

    goLayout(boxId);
  }, true);
});

window.addEventListener("focus", safeUnblockClicks);
window.addEventListener("pageshow", safeUnblockClicks);
