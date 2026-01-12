// Device-aware styling helper + existing box popover sizing
// Adds a class to <html>: device-mobile or device-desktop

(function(){
  function isMobile(){
    // Prefer viewport-based rule, then input capabilities
    const mq = window.matchMedia && window.matchMedia('(max-width: 768px)');
    const byWidth = mq ? mq.matches : (window.innerWidth <= 768);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    return byWidth || (coarse && touch);
  }

  function applyDeviceClass(){
    const root = document.documentElement;
    root.classList.toggle('device-mobile', isMobile());
    root.classList.toggle('device-desktop', !isMobile());
  }

  // initial + react to changes
  applyDeviceClass();
  window.addEventListener('resize', applyDeviceClass, {passive:true});
  window.addEventListener('orientationchange', applyDeviceClass, {passive:true});
  if (window.matchMedia) {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.addEventListener) mq.addEventListener('change', applyDeviceClass);
    else if (mq.addListener) mq.addListener(applyDeviceClass);
  }

  // --- existing logic: o-button popover responsive sizing ---
  function updateBoxSizeClass(boxEl){
    const w = boxEl.offsetWidth;
    const h = boxEl.offsetHeight;

    boxEl.classList.remove('small','tiny');

    if (w < 180 || h < 100) boxEl.classList.add('small');
    if (w < 140 || h < 80) boxEl.classList.add('tiny');
  }

  function attachBox(boxEl){
    updateBoxSizeClass(boxEl);
    new ResizeObserver(()=>updateBoxSizeClass(boxEl)).observe(boxEl);
  }

  // expose for the rest of your app
  window.BoxBoard = window.BoxBoard || {};
  window.BoxBoard.attachBox = attachBox;

  // =======================================================
  // Worker (mobile) UI
  // - Shows: Tournament title + Event buttons + simple table
  // - Reads data from existing .box elements (admin board)
  //   so the mobile view stays in sync with the board.
  // =======================================================

  function ensureWorkerUI(){
    if (!document.documentElement.classList.contains('device-mobile')) return;
    if (document.getElementById('workerApp')) return;

    const app = document.createElement('div');
    app.id = 'workerApp';
    app.innerHTML = `
      <div class="workerHeader">
        <div id="tournamentTitle" class="workerTitle" contenteditable="true" spellcheck="false">대회사 이름(수정가능)</div>
        <div class="eventTabs" role="tablist" aria-label="이벤트 선택">
          <button class="eventTab" role="tab" data-event="A" aria-selected="true">A이벤트 (ex: Main Event)</button>
          <button class="eventTab" role="tab" data-event="B" aria-selected="false">B이벤트</button>
          <button class="eventTab" role="tab" data-event="C" aria-selected="false">C이벤트</button>
        </div>
      </div>
      <div class="workerTableWrap">
        <table class="workerTable" aria-label="좌석 현황">
          <thead>
            <tr>
              <th class="colSeat">번호</th>
              <th class="colName">이름</th>
            </tr>
          </thead>
          <tbody id="workerTbody"></tbody>
        </table>
        <div id="workerEmpty" class="workerEmpty" style="display:none;">표시할 데이터가 없습니다.</div>
      </div>
    `;

    document.body.appendChild(app);

    // Persist title (nice UX)
    const titleEl = app.querySelector('#tournamentTitle');
    const savedTitle = localStorage.getItem('bb_tournament_title');
    if (savedTitle) titleEl.textContent = savedTitle;
    titleEl.addEventListener('input', ()=>{
      localStorage.setItem('bb_tournament_title', titleEl.textContent.trim());
    });

    // Tabs
    const tabs = Array.from(app.querySelectorAll('.eventTab'));
    tabs.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        tabs.forEach(b=>b.setAttribute('aria-selected', String(b===btn)));
        renderWorkerTable(btn.dataset.event || 'A');
      });
    });

    // Initial render + live updates
    renderWorkerTable('A');

    // Update when the admin board changes (best-effort)
    const mo = new MutationObserver(()=>{
      const active = tabs.find(t=>t.getAttribute('aria-selected')==='true');
      renderWorkerTable(active?.dataset.event || 'A');
    });
    mo.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true});
  }

  function renderWorkerTable(eventKey){
    const tbody = document.getElementById('workerTbody');
    const empty = document.getElementById('workerEmpty');
    if (!tbody || !empty) return;

    const rows = collectRowsFromBoard(eventKey);
    tbody.innerHTML = '';

    if (!rows.length){
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    for (const r of rows){
      const tr = document.createElement('tr');
      const tdSeat = document.createElement('td');
      const tdName = document.createElement('td');
      tdSeat.className = 'colSeat';
      tdName.className = 'colName';
      tdSeat.textContent = String(r.seat);
      tdName.textContent = r.name || '비어있음';
      tr.appendChild(tdSeat);
      tr.appendChild(tdName);
      tbody.appendChild(tr);
    }
  }

  function collectRowsFromBoard(eventKey){
    // If the main app exposes data, use it first.
    // Expected (optional): window.BoxBoard.state = { events: {A:[{seat,name}], ...} }
    const st = window.BoxBoard && window.BoxBoard.state;
    const arr = st && st.events && st.events[eventKey];
    if (Array.isArray(arr) && arr.length){
      return arr
        .map(x=>({ seat: safeInt(x.seat), name: String(x.name||'').trim() }))
        .filter(x=>x.seat!=null)
        .sort((a,b)=>a.seat-b.seat);
    }

    // DOM fallback: scan existing boxes.
    const boxes = Array.from(document.querySelectorAll('.box'));
    const rows = [];
    boxes.forEach((box, idx)=>{
      // Optional event tagging: data-event="A" on each box
      const ev = (box.dataset && (box.dataset.event || box.dataset.ev)) || '';
      if (ev && eventKey && ev !== eventKey) return;

      const seat = safeInt(
        (box.dataset && (box.dataset.seat || box.dataset.id || box.dataset.index))
      ) ?? (idx+1);

      // Try common selectors first
      let name = '';
      const nameEl = box.querySelector('[data-role="name"], .name, .boxName, .box-title, .title');
      if (nameEl) name = nameEl.textContent || '';
      else {
        // Best-effort: extract meaningful text from the box
        const raw = (box.innerText || '').trim();
        // Remove common UI glyphs and keep the first non-empty line
        const line = raw.split('\n').map(s=>s.trim()).find(Boolean) || '';
        name = line;
      }
      name = normalizeName(name);

      rows.push({ seat, name });
    });

    // Sort by seat number
    rows.sort((a,b)=>a.seat-b.seat);
    return rows;
  }

  function safeInt(v){
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeName(s){
    const t = String(s||'').replace(/\s+/g,' ').trim();
    if (!t) return '';
    // If it looks like just a number, treat as empty
    if (/^\d+$/.test(t)) return '';
    // If it contains "비어" treat as empty
    if (/비어/.test(t)) return '';
    return t;
  }

  // Build worker UI after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWorkerUI, {once:true});
  } else {
    ensureWorkerUI();
  }
})();
