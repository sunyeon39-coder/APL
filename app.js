/* Box Board v2
   - Desktop(Admin): draggable boxes on a grid board
   - Mobile(Worker): event tabs + simple table view
   State is stored in localStorage.
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ----- device class -----
  const isMobile = matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  document.documentElement.classList.toggle('device-mobile', isMobile);
  document.documentElement.classList.toggle('device-desktop', !isMobile);

  // ----- state -----
  const STORAGE_KEY = 'boxboard.v2.state';
  const TITLE_KEY = 'boxboard.v2.title';

  /** @type {{id:string,x:number,y:number,w:number,h:number,name:string,seat:string,event:'A'|'B'|'C',status?:string}[]} */
  let boxes = [];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      boxes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(boxes)) boxes = [];
    } catch {
      boxes = [];
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
  }

  function getTitle() {
    return localStorage.getItem(TITLE_KEY) || '대회사 이름(수정가능)';
  }

  function setTitle(v) {
    localStorage.setItem(TITLE_KEY, v);
  }

  // ----- Admin UI (desktop) -----
  const adminApp = $('#adminApp');
  const board = $('#board');
  const sidePanel = $('#sidePanel');
  const toggleSide = $('#toggleSide');
  const addBoxBtn = $('#addBoxBtn');
  const resetBtn = $('#resetBtn');

  function uid() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function renderAdmin() {
    if (!board) return;
    board.innerHTML = '';
    boxes.forEach(b => board.appendChild(renderBox(b)));
  }

  function renderBox(b) {
    const el = document.createElement('div');
    el.className = 'box';
    el.dataset.id = b.id;
    el.style.left = b.x + 'px';
    el.style.top = b.y + 'px';
    el.style.width = b.w + 'px';
    el.style.height = b.h + 'px';

    const seatBadge = document.createElement('div');
    seatBadge.className = 'seatBadge';
    seatBadge.textContent = b.seat ? String(b.seat) : '';

    const title = document.createElement('div');
    title.className = 'boxTitle';
    title.textContent = b.name || '비어있음';

    const timer = document.createElement('div');
    timer.className = 'boxSub';
    timer.textContent = b.status || '';

    const infoBtn = document.createElement('button');
    infoBtn.className = 'miniIcon';
    infoBtn.type = 'button';
    infoBtn.textContent = 'ⓘ';
    infoBtn.title = '설정';

    const pop = document.createElement('div');
    pop.className = 'boxPopover';
    pop.hidden = true;

    pop.innerHTML = `
      <div class="popRow">
        <div class="popLabel">이벤트</div>
        <div class="popCtl">
          <select class="popSelect" data-k="event">
            <option value="A">A이벤트</option>
            <option value="B">B이벤트</option>
            <option value="C">C이벤트</option>
          </select>
        </div>
      </div>
      <div class="popRow">
        <div class="popLabel">좌석번호</div>
        <div class="popCtl">
          <input class="popInput" data-k="seat" inputmode="numeric" placeholder="예: 1" />
        </div>
      </div>
      <div class="popRow">
        <div class="popLabel">이름</div>
        <div class="popCtl">
          <input class="popInput" data-k="name" placeholder="예: 지환" />
        </div>
      </div>
      <div class="popRow">
        <div class="popLabel">상태</div>
        <div class="popCtl">
          <input class="popInput" data-k="status" placeholder="예: 189:47:12" />
        </div>
      </div>
      <div class="popActions">
        <button class="btnSmall" data-act="close" type="button">닫기</button>
        <button class="btnSmall btnDanger" data-act="delete" type="button">삭제</button>
      </div>
    `;

    const sel = $('.popSelect', pop);
    sel.value = b.event || 'A';
    $$('.popInput', pop).forEach(inp => {
      const k = inp.dataset.k;
      inp.value = (b[k] ?? '') + '';
    });

    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
    });

    pop.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const act = t.getAttribute('data-act');
      if (act === 'close') {
        pop.hidden = true;
        return;
      }
      if (act === 'delete') {
        boxes = boxes.filter(x => x.id !== b.id);
        saveState();
        renderAdmin();
        renderWorker();
      }
    });

    pop.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const k = t.getAttribute('data-k');
      if (!k) return;
      const box = boxes.find(x => x.id === b.id);
      if (!box) return;
      // @ts-ignore
      box[k] = t.value;
      saveState();
      // live update visuals
      seatBadge.textContent = box.seat ? String(box.seat) : '';
      title.textContent = box.name || '비어있음';
      timer.textContent = box.status || '';
      renderWorker();
    });

    sel.addEventListener('change', () => {
      const box = boxes.find(x => x.id === b.id);
      if (!box) return;
      box.event = sel.value;
      saveState();
      renderWorker();
    });

    // Double click title edit
    el.addEventListener('dblclick', () => {
      const box = boxes.find(x => x.id === b.id);
      if (!box) return;
      const v = prompt('이름을 입력하세요', box.name || '');
      if (v === null) return;
      box.name = v.trim();
      saveState();
      title.textContent = box.name || '비어있음';
      renderWorker();
    });

    // Drag
    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onDown(ev) {
      // don't start drag from inside popover
      if (ev.target === infoBtn || (ev.target instanceof HTMLElement && ev.target.closest('.boxPopover'))) return;
      dragging = true;
      const p = getPoint(ev);
      startX = p.x; startY = p.y;
      origX = b.x; origY = b.y;
      el.classList.add('dragging');
      pop.hidden = true;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }

    function onMove(ev) {
      if (!dragging) return;
      if (ev.cancelable) ev.preventDefault();
      const p = getPoint(ev);
      const dx = p.x - startX;
      const dy = p.y - startY;
      const rect = board.getBoundingClientRect();
      const nx = clamp(origX + dx, 0, rect.width - b.w);
      const ny = clamp(origY + dy, 0, rect.height - b.h);
      b.x = Math.round(nx);
      b.y = Math.round(ny);
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      saveState();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      renderWorker();
    }

    function getPoint(ev) {
      if (ev.touches && ev.touches[0]) {
        return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      }
      return { x: ev.clientX, y: ev.clientY };
    }

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: true });

    el.appendChild(seatBadge);
    el.appendChild(infoBtn);
    el.appendChild(title);
    el.appendChild(timer);
    el.appendChild(pop);
    return el;
  }

  function addBox() {
    const rect = board.getBoundingClientRect();
    const b = {
      id: uid(),
      x: Math.round(rect.width * 0.1),
      y: Math.round(rect.height * 0.1),
      w: 180,
      h: 100,
      name: '비어있음',
      seat: '',
      event: 'A',
      status: ''
    };
    boxes.push(b);
    saveState();
    renderAdmin();
    renderWorker();
  }

  function resetAll() {
    if (!confirm('모든 박스를 초기화할까요?')) return;
    boxes = [];
    saveState();
    renderAdmin();
    renderWorker();
  }

  // Sidebar toggle: IMPORTANT null-guard
  if (toggleSide && sidePanel) {
    toggleSide.addEventListener('click', () => {
      sidePanel.classList.toggle('open');
    });
  }

  if (addBoxBtn) addBoxBtn.addEventListener('click', addBox);
  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  // ----- Worker UI (mobile) -----
  const workerRoot = $('#workerApp');
  let activeEvent = 'A';

  function renderWorker() {
    if (!workerRoot) return;

    // Only show worker UI on mobile
    workerRoot.hidden = !isMobile;
    if (!isMobile) return;

    const title = getTitle();

    // build
    workerRoot.innerHTML = `
      <div class="workerHeader">
        <div class="workerTitle" id="workerTitle" role="button" tabindex="0">${escapeHtml(title)}</div>
        <div class="eventTabs" role="tablist" aria-label="이벤트 선택">
          ${['A','B','C'].map(k => `
            <button class="eventTab" role="tab" data-ev="${k}" aria-selected="${k===activeEvent}">
              ${k}이벤트${k==='A' ? ' (ex:Main Event)' : ''}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="workerTableWrap">
        <table class="workerTable" aria-label="좌석 목록">
          <thead>
            <tr><th class="colSeat">번호</th><th class="colName">이름</th></tr>
          </thead>
          <tbody id="workerTbody"></tbody>
        </table>
        <div id="workerEmpty" class="workerEmpty" hidden>표시할 데이터가 없어요.</div>
      </div>
    `;

    // bind title edit
    const titleEl = $('#workerTitle', workerRoot);
    const editTitle = () => {
      const v = prompt('대회사 이름을 입력하세요', getTitle());
      if (v === null) return;
      setTitle(v.trim() || '대회사 이름(수정가능)');
      renderWorker();
    };
    titleEl?.addEventListener('click', editTitle);
    titleEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editTitle(); }
    });

    // tabs
    $$('.eventTab', workerRoot).forEach(btn => {
      btn.addEventListener('click', () => {
        activeEvent = btn.dataset.ev || 'A';
        renderWorker();
      });
    });

    // fill table
    const tbody = $('#workerTbody', workerRoot);
    const empty = $('#workerEmpty', workerRoot);

    const rows = boxes
      .filter(b => (b.event || 'A') === activeEvent)
      .map(b => ({
        seat: (b.seat || '').trim(),
        name: (b.name || '비어있음').trim()
      }))
      .filter(r => r.seat || r.name)
      .sort((a,b) => {
        const ai = parseInt(a.seat,10);
        const bi = parseInt(b.seat,10);
        const aNum = Number.isFinite(ai) ? ai : 1e9;
        const bNum = Number.isFinite(bi) ? bi : 1e9;
        return aNum - bNum;
      });

    if (!tbody) return;
    tbody.innerHTML = '';

    if (rows.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="colSeat">${escapeHtml(r.seat || '-')}</td><td class="colName">${escapeHtml(r.name || '')}</td>`;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // ----- boot -----
  function boot() {
    loadState();

    // desktop only: make sure board has a size
    if (board) {
      // initial demo if empty
      if (boxes.length === 0) {
        boxes = [
          { id: uid(), x: 60, y: 40, w: 220, h: 110, name: 'ddd', seat: '1', event: 'A', status: '189:47:12' },
          { id: uid(), x: 320, y: 40, w: 220, h: 110, name: '지환', seat: '2', event: 'A', status: '189:46:25' },
          { id: uid(), x: 60, y: 170, w: 220, h: 110, name: '비어있음', seat: '3', event: 'A', status: '' },
          { id: uid(), x: 60, y: 300, w: 220, h: 110, name: '비어있음', seat: '4', event: 'A', status: '' },
          { id: uid(), x: 320, y: 200, w: 320, h: 120, name: '비어있음', seat: '5', event: 'A', status: '' },
        ];
        saveState();
      }

      renderAdmin();
    }

    renderWorker();

    // rerender on resize (switching between mobile/desktop)
    window.addEventListener('resize', () => {
      const nowMobile = matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (nowMobile !== isMobile) {
        location.reload();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
