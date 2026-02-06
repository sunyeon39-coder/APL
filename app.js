// app.js — CLICK SAFE + CARD NAV (minimal, non-destructive)
// 목적: "카드가 안 눌림" 증상만 해결 + 카드 클릭 시 layout으로 이동
// 기존 렌더/Firestore 로직이 따로 있어도 충돌하지 않도록 '이벤트 위임'만 사용

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

  // 숨김 처리된 overlay류는 클릭을 먹지 않게
  try{
    const blockers = document.querySelectorAll(".overlay, .loading, .blocker, .page-block, .modal-block, .layout-loading");
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

  // 혹시 board 위를 덮는 투명 레이어가 있으면(대표적으로 ::before/absolute layer),
  // 화면에 '보이지 않는' 상태면 pointer-events 끄기
  try{
    const suspects = document.querySelectorAll("body *");
    for (const el of suspects){
      const cs = getComputedStyle(el);
      if (cs.pointerEvents !== "auto") continue;
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;

      // 너무 비싼 계산 방지: 큰 요소만
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 200) continue;

      const looksInvisible =
        cs.opacity === "0" ||
        cs.visibility === "hidden" ||
        cs.display === "none" ||
        el.classList.contains("hidden") ||
        el.getAttribute("aria-hidden") === "true";

      if (looksInvisible){
        el.style.pointerEvents = "none";
      }
    }
  }catch(e){}
}

function getBoxIdFromCard(card){
  if (!card) return "";
  return (
    card.dataset.boxId ||
    card.dataset.boxid ||
    card.dataset.id ||
    card.getAttribute("data-box-id") ||
    card.getAttribute("data-boxid") ||
    ""
  );
}

function goLayout(boxId){
  const eventId = getEventId();
  const url = `layout_index.html?boxId=${encodeURIComponent(boxId)}${eventId ? `&eventId=${encodeURIComponent(eventId)}` : ""}`;
  location.href = url;
}

document.addEventListener("DOMContentLoaded", () => {
  safeUnblockClicks();

  // 카드 클릭 → layout 이동 (hover 버튼 클릭은 제외)
  document.addEventListener("click", (e) => {
    // hover 버튼들(✏️, ✖ 등)은 기존 핸들러에게 넘김
    if (e.target.closest(".hover-btn")) return;

    const card = e.target.closest(".card");
    if (!card) return;

    const boxId = getBoxIdFromCard(card);

    // boxId가 없으면 기존 로직을 방해하지 않음
    if (!boxId) return;

    goLayout(boxId);
  }, true); // capture로 먼저 받아서 "안 눌림" 상황에서도 최대한 캐치
});

// 혹시 동적으로 렌더되며 클릭이 죽는 케이스 대비
window.addEventListener("focus", safeUnblockClicks);
window.addEventListener("pageshow", safeUnblockClicks);
