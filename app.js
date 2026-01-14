const app = document.getElementById('app');

let view = 'dashboard';
let activeSection = null;
let dragTarget = null;
let offsetX = 0;
let offsetY = 0;

const sections = [
  {
    id: 52,
    title: '#52 Closer Event - Monster Stack',
    status: 'opened',
    buyin: '1,100,000 KRW',
    time: '11:18',
    entries: 138,
    board: {
      boxes: [
        { id: 1, x: 60, y: 80, name: '종욱', time: '00:02:04' }
      ]
    }
  },
  {
    id: 41,
    title: '#41 Challenger Event DAY 2',
    status: 'opened',
    buyin: '2,000,000 KRW',
    time: '12:00',
    entries: '-',
    board: { boxes: [] }
  }
];

function render() {
  app.innerHTML = '';
  view === 'dashboard' ? renderDashboard() : renderBoard();
}

/* ---------------- DASHBOARD ---------------- */

function renderDashboard() {
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = '<h1>15 January, 2026 Thursday</h1>';

  const grid = document.createElement('div');
  grid.className = 'section-grid';

  sections.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.onclick = () => {
      activeSection = sec;
      view = 'board';
      render();
    };

    card.innerHTML = `
      <div class="section-title">${sec.title}
        <span class="badge">${sec.status === 'opened' ? 'Opened' : 'Running'}</span>
      </div>
      <div class="info-row">
        <div class="info"><span>Buy-in</span><strong>${sec.buyin}</strong></div>
        <div class="info"><span>Time</span><strong>${sec.time}</strong></div>
        <div class="info"><span>Entries</span><strong>${sec.entries}</strong></div>
      </div>
    `;
    grid.appendChild(card);
  });

  app.append(header, grid);
}

/* ---------------- BOARD ---------------- */

function renderBoard() {
  const header = document.createElement('div');
  header.className = 'board-header';
  header.innerHTML = `
    <h2>${activeSection.title}</h2>
    <button class="back-btn">← Back</button>
  `;
  header.querySelector('.back-btn').onclick = () => {
    view = 'dashboard';
    activeSection = null;
    render();
  };

  const board = document.createElement('div');
  board.className = 'board-area';

  activeSection.board.boxes.forEach(box => {
    const el = document.createElement('div');
    el.className = 'box';
    el.style.left = box.x + 'px';
    el.style.top = box.y + 'px';

    el.innerHTML = `
      <strong>${box.id}</strong>
      <span>${box.name}</span>
      <span>${box.time}</span>
    `;

    el.onmousedown = e => {
      dragTarget = box;
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    };

    board.appendChild(el);
  });

  board.onmousemove = e => {
    if (!dragTarget) return;
    dragTarget.x = e.offsetX - offsetX;
    dragTarget.y = e.offsetY - offsetY;
    render();
  };

  board.onmouseup = () => dragTarget = null;
  board.onmouseleave = () => dragTarget = null;

  app.append(header, board);
}

render();
