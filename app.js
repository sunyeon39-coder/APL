/* Box Board - PC (restore-style) 2026-01-13
   - Dark glass UI similar to your screenshot
   - Core features: boxes, waiting list, drag-drop assignment, multi-select, delete, basic align, zoom.
*/
(() => {
  const STORE_KEY = "boxboard_pc_v1";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    zoom: 1,
    boxScale: 1.1,
    gapX: 120,
    gapY: 100,
    boxes: [],         // {id, seat, x, y, name, startMs}
    waiting: [],       // {id, name, startMs}
    selected: new Set(),
    sidebarHidden: false,
    selectMode: true,
    draggingWaitId: null
  };

  // ---------- Utilities ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = () => Date.now();
  function fmt(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const hh = String(Math.floor(s/3600)).padStart(2,"0");
    const mm = String(Math.floor((s%3600)/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${hh}:${mm}:${ss}`;
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  // ---------- Persistence ----------
  function save(){
    const payload = {
      zoom: state.zoom,
      boxScale: state.boxScale,
      gapX: state.gapX,
      gapY: state.gapY,
      boxes: state.boxes,
      waiting: state.waiting,
      sidebarHidden: state.sidebarHidden
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  }
  function load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return;
      const p = JSON.parse(raw);
      if(p && typeof p === "object"){
        state.zoom = p.zoom ?? state.zoom;
        state.boxScale = p.boxScale ?? state.boxScale;
        state.gapX = p.gapX ?? state.gapX;
        state.gapY = p.gapY ?? state.gapY;
        state.boxes = Array.isArray(p.boxes) ? p.boxes : state.boxes;
        state.waiting = Array.isArray(p.waiting) ? p.waiting : state.waiting;
        state.sidebarHidden = !!p.sidebarHidden;
      }
    }catch(e){}
  }

  // ---------- DOM ----------
  const board = $("#board");
  const sidebar = $("#sidebar");
  const toggleSide = $("#toggleSide");

  const zoomPct = $("#zoomPct");
  const zoomIn = $("#zoomIn");
  const zoomOut = $("#zoomOut");
  const resetAll = $("#resetAll");

  const alignH = $("#alignH");
  const alignV = $("#alignV");
  const selectMode = $("#selectMode");

  const addBoxBtn = $("#addBox");
  const resetBoxesBtn = $("#resetBoxes");

  const waitName = $("#waitName");
  const addWaitBtn = $("#addWait");
  const waitSearch = $("#waitSearch");
  const waitList = $("#waitList");

  const segBtns = $$(".seg");
  const panels = $$(".panel");

  const gapXRange = $("#gapX");
  const gapYRange = $("#gapY");
  const boxScaleRange = $("#boxScale");
  const gapXBtn = $("#gapXBtn");
  const gapYBtn = $("#gapYBtn");

  const autoGrid = $("#autoGrid");
  const clearSelection = $("#clearSelection");

  const exportJson = $("#exportJson");
  const importJson = $("#importJson");
  const jsonArea = $("#jsonArea");

  // ---------- Rendering ----------
  function applyZoom(){
    zoomPct.textContent = Math.round(state.zoom * 100) + "%";
    board.style.transformOrigin = "top left";
    board.style.transform = `scale(${state.zoom})`;
    // keep board from shrinking layout: we scale only content, but board container stays same.
  }

  function applySidebar(){
    sidebar.classList.toggle("hidden", state.sidebarHidden);
  }

  function renderWaiting(){
    const q = (waitSearch.value || "").trim().toLowerCase();
    waitList.innerHTML = "";
    const items = state.waiting
      .filter(w => !q || w.name.toLowerCase().includes(q))
      .map((w, idx) => ({...w, idx: idx+1}));

    for(const w of items){
      const el = document.createElement("div");
      el.className = "wait-item";
      el.draggable = true;
      el.dataset.id = w.id;
      el.innerHTML = `
        <div class="num">${w.idx}</div>
        <div class="meta">
          <div class="name">${escapeHtml(w.name)}</div>
          <div class="timer">대기 ${fmt(now()-w.startMs)}</div>
        </div>
        <button class="del">삭제</button>
      `;
      el.addEventListener("dragstart", (e) => {
        state.draggingWaitId = w.id;
        e.dataTransfer.setData("text/plain", w.id);
      });
      el.addEventListener("dragend", () => state.draggingWaitId = null);

      el.querySelector(".del").addEventListener("click", () => {
        state.waiting = state.waiting.filter(x => x.id !== w.id);
        save();
        renderWaiting();
      });

      waitList.appendChild(el);
    }
  }

  function renderBoxes(){
    // remove old nodes
    $$(".box", board).forEach(n => n.remove());

    for(const b of state.boxes){
      const el = document.createElement("div");
      el.className = "box";
      el.dataset.id = b.id;
      el.style.left = b.x + "px";
      el.style.top = b.y + "px";
      el.style.width = Math.round(190 * state.boxScale) + "px";
      el.style.height = Math.round(78 * state.boxScale) + "px";

      const nameText = (b.name && b.name.trim()) ? b.name : "비어있음";
      const timerText = b.startMs ? fmt(now()-b.startMs) : "00:00:00";

      el.innerHTML = `
        <div class="seat">${escapeHtml(String(b.seat ?? ""))}</div>
        <div class="content">
          <div class="name" title="${escapeHtml(nameText)}">${escapeHtml(nameText)}</div>
          <div class="subrow">
            <div class="badge">대기 ${timerText}</div>
            <div class="mini">
              <button class="toWait" title="대기로">↩</button>
              <button class="clear" title="비우기">×</button>
            </div>
          </div>
        </div>
      `;

      // selection
      el.addEventListener("mousedown", (e) => {
        if(e.button !== 0) return;
        board.focus();

        const id = b.id;
        const multi = e.shiftKey;
        if(!multi){
          // if clicking a non-selected, make it single selection
          if(!state.selected.has(id)){
            state.selected.clear();
            state.selected.add(id);
          }
        }else{
          if(state.selected.has(id)) state.selected.delete(id);
          else state.selected.add(id);
        }
        updateSelectedStyles();
      });

      // drag move
      el.addEventListener("mousedown", (e) => startDragBox(e, b.id));

      // DnD drop from waiting
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        el.style.borderColor = "rgba(86,156,255,0.55)";
      });
      el.addEventListener("dragleave", () => {
        el.style.borderColor = "";
      });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.style.borderColor = "";
        const wid = e.dataTransfer.getData("text/plain") || state.draggingWaitId;
        if(!wid) return;
        assignWaitingToBox(wid, b.id);
      });

      // actions
      el.querySelector(".toWait").addEventListener("click", (e) => {
        e.stopPropagation();
        sendBoxToWaiting(b.id);
      });
      el.querySelector(".clear").addEventListener("click", (e) => {
        e.stopPropagation();
        clearBox(b.id);
      });

      // double click name -> to waiting
      el.querySelector(".name").addEventListener("dblclick", (e) => {
        e.stopPropagation();
        sendBoxToWaiting(b.id);
      });

      // double click box -> rename
      el.addEventListener("dblclick", (e) => {
        // if double clicking on button, ignore
        if(e.target.closest("button")) return;
        const newName = prompt("이름 수정", b.name || "");
        if(newName === null) return;
        b.name = newName.trim();
        if(b.name) b.startMs = b.startMs || now();
        save();
        renderBoxes();
      });

      board.appendChild(el);
    }

    updateSelectedStyles();
  }

  function updateSelectedStyles(){
    $$(".box", board).forEach(el => {
      el.classList.toggle("selected", state.selected.has(el.dataset.id));
    });
  }

  function renderAll(){
    applySidebar();
    applyZoom();
    gapXRange.value = String(state.gapX);
    gapYRange.value = String(state.gapY);
    boxScaleRange.value = String(Math.round(state.boxScale * 100));
    renderWaiting();
    renderBoxes();
  }

  // ---------- Box operations ----------
  function addBox(){
    const nextSeat = nextSeatNumber();
    const b = {
      id: uid(),
      seat: nextSeat,
      x: 420 + (state.boxes.length % 5) * 240,
      y: 90 + Math.floor(state.boxes.length / 5) * 120,
      name: "",
      startMs: 0
    };
    state.boxes.push(b);
    save();
    renderBoxes();
  }
  function resetBoxes(){
    if(!confirm("모든 박스를 초기화할까요?")) return;
    state.boxes = [];
    state.selected.clear();
    save();
    renderAll();
  }
  function nextSeatNumber(){
    const used = new Set(state.boxes.map(b => Number(b.seat)).filter(n => !Number.isNaN(n)));
    let n=1;
    while(used.has(n)) n++;
    return n;
  }
  function clearBox(boxId){
    const b = state.boxes.find(x => x.id === boxId);
    if(!b) return;
    b.name = "";
    b.startMs = 0;
    save();
    renderBoxes();
  }
  function sendBoxToWaiting(boxId){
    const b = state.boxes.find(x => x.id === boxId);
    if(!b || !b.name) return;
    // add to waiting with preserved waiting time start as now
    state.waiting.unshift({ id: uid(), name: b.name, startMs: now() });
    b.name = "";
    b.startMs = 0;
    save();
    renderAll();
  }
  function assignWaitingToBox(waitId, boxId){
    const w = state.waiting.find(x => x.id === waitId);
    const b = state.boxes.find(x => x.id === boxId);
    if(!w || !b) return;

    // If box already occupied -> send occupant to waiting (top)
    if(b.name){
      state.waiting.unshift({ id: uid(), name: b.name, startMs: now() });
    }
    b.name = w.name;
    b.startMs = now();
    state.waiting = state.waiting.filter(x => x.id !== waitId);

    save();
    renderAll();
  }

  // ---------- Drag move boxes ----------
  let drag = null; // {startX,startY, orig: [{id,x,y}], moved:false}
  function startDragBox(e, id){
    const target = e.target.closest(".box");
    if(!target) return;
    if(e.target.closest("button")) return;

    const boxId = id;
    // if clicked box not selected, select only that
    if(!state.selected.has(boxId) && !e.shiftKey){
      state.selected.clear();
      state.selected.add(boxId);
      updateSelectedStyles();
    }

    const ids = Array.from(state.selected);
    const orig = ids.map(i => {
      const b = state.boxes.find(x => x.id === i);
      return { id:i, x:b?.x ?? 0, y:b?.y ?? 0 };
    });

    drag = { startX: e.clientX, startY: e.clientY, orig, moved:false };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }
  function onDragMove(e){
    if(!drag) return;
    const dx = (e.clientX - drag.startX) / state.zoom;
    const dy = (e.clientY - drag.startY) / state.zoom;
    if(Math.abs(dx)+Math.abs(dy) > 1) drag.moved = true;

    for(const o of drag.orig){
      const b = state.boxes.find(x => x.id === o.id);
      if(!b) continue;
      b.x = Math.round(o.x + dx);
      b.y = Math.round(o.y + dy);
    }
    renderBoxes();
  }
  function onDragEnd(){
    if(!drag) return;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
    save();
    drag = null;
  }

  // ---------- Align / Layout ----------
  function alignSelectedHorizontal(){
    const ids = Array.from(state.selected);
    if(ids.length < 2) return;
    const xs = ids.map(id => state.boxes.find(b => b.id===id)?.x ?? 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ids.map(id => state.boxes.find(b => b.id===id)?.y ?? 0));
    // sort by x
    const boxes = ids.map(id => state.boxes.find(b => b.id===id)).filter(Boolean).sort((a,b)=>a.x-b.x);
    let x = minX;
    for(const b of boxes){
      b.x = x;
      b.y = minY;
      x += state.gapX;
    }
    save(); renderBoxes();
  }
  function alignSelectedVertical(){
    const ids = Array.from(state.selected);
    if(ids.length < 2) return;
    const ys = ids.map(id => state.boxes.find(b => b.id===id)?.y ?? 0);
    const minY = Math.min(...ys);
    const minX = Math.min(...ids.map(id => state.boxes.find(b => b.id===id)?.x ?? 0));
    const boxes = ids.map(id => state.boxes.find(b => b.id===id)).filter(Boolean).sort((a,b)=>a.y-b.y);
    let y = minY;
    for(const b of boxes){
      b.y = y;
      b.x = minX;
      y += state.gapY;
    }
    save(); renderBoxes();
  }

  function autoGridLayout(){
    if(state.boxes.length === 0) return;
    const cols = 6;
    const startX = 420;
    const startY = 90;
    state.boxes.forEach((b, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      b.x = startX + c * state.gapX;
      b.y = startY + r * state.gapY;
    });
    save(); renderBoxes();
  }

  // ---------- Tabs ----------
  function setTab(tab){
    segBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === tab));
  }

  // ---------- Event wiring ----------
  function wire(){
    // sidebar toggle
    toggleSide?.addEventListener("click", () => {
      state.sidebarHidden = !state.sidebarHidden;
      save();
      applySidebar();
    });

    // tabs
    segBtns.forEach(btn => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

    // wait add
    addWaitBtn.addEventListener("click", () => {
      const name = (waitName.value || "").trim();
      if(!name) return;
      state.waiting.push({ id: uid(), name, startMs: now() });
      waitName.value = "";
      save();
      renderWaiting();
    });
    waitName.addEventListener("keydown", (e) => {
      if(e.key === "Enter") addWaitBtn.click();
    });
    waitSearch.addEventListener("input", () => renderWaiting());

    // boxes
    addBoxBtn.addEventListener("click", addBox);
    resetBoxesBtn.addEventListener("click", resetBoxes);

    // zoom
    function setZoom(z){
      state.zoom = clamp(z, 0.35, 1.6);
      save();
      applyZoom();
    }
    zoomIn.addEventListener("click", () => setZoom(state.zoom + 0.05));
    zoomOut.addEventListener("click", () => setZoom(state.zoom - 0.05));
    resetAll.addEventListener("click", () => {
      if(!confirm("줌/배치 옵션을 초기화할까요? (박스/대기 데이터는 유지)")) return;
      state.zoom = 1;
      state.boxScale = 1.1;
      state.gapX = 120;
      state.gapY = 100;
      save();
      renderAll();
    });

    // wheel zoom
    board.addEventListener("wheel", (e) => {
      if(!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      setZoom(state.zoom + (delta > 0 ? -0.05 : 0.05));
    }, { passive:false });

    // align
    alignH.addEventListener("click", alignSelectedHorizontal);
    alignV.addEventListener("click", alignSelectedVertical);

    // layout controls
    gapXRange.addEventListener("input", () => {
      state.gapX = Number(gapXRange.value);
      save();
    });
    gapYRange.addEventListener("input", () => {
      state.gapY = Number(gapYRange.value);
      save();
    });
    boxScaleRange.addEventListener("input", () => {
      state.boxScale = Number(boxScaleRange.value) / 100;
      save();
      renderBoxes();
    });
    gapXBtn.addEventListener("click", () => setTab("layout"));
    gapYBtn.addEventListener("click", () => setTab("layout"));

    autoGrid.addEventListener("click", autoGridLayout);
    clearSelection.addEventListener("click", () => {
      state.selected.clear();
      updateSelectedStyles();
    });

    // select mode indicator (placeholder)
    selectMode.addEventListener("click", () => {
      state.selectMode = !state.selectMode;
      selectMode.classList.toggle("danger", state.selectMode);
    });

    // board background click clears selection
    board.addEventListener("mousedown", (e) => {
      if(e.target === board){
        state.selected.clear();
        updateSelectedStyles();
      }
    });

    // keyboard shortcuts
    board.addEventListener("keydown", (e) => {
      if(e.key === "Tab"){
        e.preventDefault();
        state.sidebarHidden = !state.sidebarHidden;
        save();
        applySidebar();
        return;
      }
      if(e.key === "Delete" || e.key === "Backspace"){
        if(state.selected.size){
          if(confirm("선택한 박스를 삭제할까요?")){
            const ids = new Set(state.selected);
            state.boxes = state.boxes.filter(b => !ids.has(b.id));
            state.selected.clear();
            save();
            renderBoxes();
          }
        }
      }
      if(e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)){
        e.preventDefault();
        state.selected = new Set(state.boxes.map(b => b.id));
        updateSelectedStyles();
      }
      if(e.key === "Escape"){
        state.selected.clear();
        updateSelectedStyles();
      }
    });

    // export/import
    exportJson.addEventListener("click", () => {
      const payload = {
        boxes: state.boxes,
        waiting: state.waiting,
        settings: { zoom: state.zoom, gapX: state.gapX, gapY: state.gapY, boxScale: state.boxScale }
      };
      jsonArea.value = JSON.stringify(payload, null, 2);
      setTab("box");
    });
    importJson.addEventListener("click", () => {
      try{
        const raw = jsonArea.value.trim();
        if(!raw) return;
        const p = JSON.parse(raw);
        if(p.boxes) state.boxes = p.boxes;
        if(p.waiting) state.waiting = p.waiting;
        if(p.settings){
          state.zoom = p.settings.zoom ?? state.zoom;
          state.gapX = p.settings.gapX ?? state.gapX;
          state.gapY = p.settings.gapY ?? state.gapY;
          state.boxScale = p.settings.boxScale ?? state.boxScale;
        }
        save();
        renderAll();
        alert("불러오기 완료");
      }catch(err){
        alert("JSON 파싱 실패");
      }
    });

    // tick timers
    setInterval(() => {
      // Update timers without full rebuild where possible (simple for now)
      $$(".wait-item .timer").forEach((el, idx) => {
        const item = state.waiting.filter(w => {
          const q = (waitSearch.value || "").trim().toLowerCase();
          return !q || w.name.toLowerCase().includes(q);
        })[idx];
        if(item) el.textContent = "대기 " + fmt(now()-item.startMs);
      });
      $$(".box").forEach((boxEl) => {
        const id = boxEl.dataset.id;
        const b = state.boxes.find(x => x.id === id);
        if(!b) return;
        const badge = boxEl.querySelector(".badge");
        if(badge){
          const t = b.startMs ? fmt(now()-b.startMs) : "00:00:00";
          badge.textContent = "대기 " + t;
        }
      });
    }, 500);
  }

  // ---------- Helpers ----------
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------- Boot ----------
  load();
  wire();
  renderAll();

  // If empty, seed a couple boxes for convenience (optional)
  if(state.boxes.length === 0){
    // do nothing; user can add
  }
})();
