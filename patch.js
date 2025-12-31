/**
 * box-board patch: prevent canvas "push right" & reduce jank on assign-to-box
 * - Locks scroll position around render calls
 * - Coalesces repeated renders into 1 per animation frame
 *
 * How to use:
 * 1) Place this file as `patch.js` next to index.html/app.js
 * 2) In index.html, add AFTER app.js:
 *      <script src="./patch.js?v=1"></script>
 *
 * Notes:
 * - This is a non-invasive monkey patch. It does NOT modify your app.js.
 * - It will wrap window.render (if present) and window.seatPersonToBox (if present).
 */

(function () {
  "use strict";

  function findScroller() {
    return (
      document.querySelector("#canvasWrap") ||
      document.querySelector(".canvas-wrap") ||
      document.querySelector("#canvas")?.parentElement ||
      document.scrollingElement ||
      document.documentElement ||
      document.body
    );
  }

  function withScrollLock(scroller, fn) {
    if (!scroller || typeof fn !== "function") return fn?.();
    const sx = scroller.scrollLeft;
    const sy = scroller.scrollTop;
    try {
      return fn();
    } finally {
      scroller.scrollLeft = sx;
      scroller.scrollTop = sy;
      requestAnimationFrame(() => {
        scroller.scrollLeft = sx;
        scroller.scrollTop = sy;
      });
    }
  }

  function wrapRender(renderFn) {
    let queued = false;
    let lastArgs = null;

    function requestRenderCoalesced(...args) {
      lastArgs = args;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const scroller = findScroller();
        withScrollLock(scroller, () => renderFn.apply(window, lastArgs || []));
      });
    }

    requestRenderCoalesced.__original = renderFn;
    requestRenderCoalesced.__patched_by_boxboard = true;
    return requestRenderCoalesced;
  }

  function patch() {
    // Wrap render()
    if (typeof window.render === "function" && !window.render.__patched_by_boxboard) {
      const original = window.render;
      window.render = wrapRender(original);
      console.log("[patch.js] Wrapped window.render(): coalesced + scroll lock");
    }

    // Wrap seatPersonToBox()
    if (typeof window.seatPersonToBox === "function" && !window.seatPersonToBox.__patched_by_boxboard) {
      const originalSeat = window.seatPersonToBox;
      const wrappedSeat = function (...args) {
        const scroller = findScroller();
        return withScrollLock(scroller, () => originalSeat.apply(window, args));
      };
      wrappedSeat.__original = originalSeat;
      wrappedSeat.__patched_by_boxboard = true;
      window.seatPersonToBox = wrappedSeat;
      console.log("[patch.js] Wrapped window.seatPersonToBox(): scroll lock");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patch, { once: true });
  } else {
    patch();
  }
})();
