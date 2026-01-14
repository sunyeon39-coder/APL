const app = document.getElementById('app');

let view = 'dashboard';
let activeSection = null;

const sections = [
  { id: 52, title: '#52 Closer Event - Monster Stack', status: 'opened', buyin: '1,100,000 KRW', time: '11:18', entries: 138 },
  { id: 41, title: '#41 Challenger Event DAY 2', status: 'opened', buyin: '2,000,000 KRW', time: '12:00', entries: '-' },
  { id: 1, title: "King's Debut Open DAY 1/C", status: 'running', buyin: '5,000 USDT', time: '13:00', entries: 148 },
  { id: 2, title: 'S2 - NLH 8 Handed Turbo', status: 'running', buyin: '8,000 USDT', time: '15:30', entries: '-' }
];

function render() {
  app.innerHTML = '';
  if (view === 'dashboard') renderDashboard();
  else renderBoard();
}

function renderDashboard() {
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = '<h1>15 January, 2026 Thursday</h1>';

  const grid = document.createElement('div');
  grid.className = 'section-grid';

  sections.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'section-card ' + (sec.status === 'running' ? 'running' : '');
    card.onclick = () => {
      activeSection = sec;
      view = 'board';
      render();
    };

    card.innerHTML = `
      <div class="section-title">
        ${sec.title}
        <span class="badge ${sec.status === 'running' ? 'running' : ''}">
          ${sec.status === 'running' ? 'Running' : 'Opened'}
        </span>
      </div>
      <div class="info-row">
        <div class="info"><span>Buy-in</span><strong>${sec.buyin}</strong></div>
        <div class="info"><span>Time</span><strong>${sec.time}</strong></div>
        <div class="info"><span>Entries</span><strong>${sec.entries}</strong></div>
      </div>
    `;
    grid.appendChild(card);
  });

  app.appendChild(header);
  app.appendChild(grid);
}

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

  app.appendChild(header);
  app.appendChild(board);
}

render();
