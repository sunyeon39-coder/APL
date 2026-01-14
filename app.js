
/**
 * Box Board – Section-aware version
 * - Each section has its own board state
 * - State persisted in localStorage
 * - Existing UI/CSS preserved
 */

const STORAGE_KEY = 'boxBoard.sections.v1';

let currentSectionId = null;
let state = loadAllSections();

/* ================== STORAGE ================== */
function loadAllSections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllSections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSectionState(id) {
  if (!state[id]) {
    state[id] = {
      waitList: [],
      assignedList: [],
      boxes: [],
      zoom: 1,
      sideCollapsed: false
    };
    saveAllSections();
  }
  return state[id];
}

/* ================== VIEW SWITCH ================== */
function openSection(sectionId) {
  currentSectionId = sectionId;
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  loadBoard(sectionId);
}

function backToDashboard() {
  saveBoard();
  currentSectionId = null;
  document.getElementById('appRoot').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
}

/* ================== BOARD ENGINE ================== */
let boardState = null;

function loadBoard(sectionId) {
  boardState = getSectionState(sectionId);
  restoreUI();
}

function saveBoard() {
  if (!currentSectionId) return;
  state[currentSectionId] = boardState;
  saveAllSections();
}

function restoreUI() {
  // minimal restore hooks (existing logic can be expanded)
  renderBoxes();
}

function renderBoxes() {
  const layer = document.getElementById('boxesLayer');
  if (!layer) return;
  layer.innerHTML = '';

  boardState.boxes.forEach(box => {
    const el = document.createElement('div');
    el.className = 'box';
    el.style.left = box.x + 'px';
    el.style.top = box.y + 'px';
    el.innerHTML = `
      <div class="boxInner">
        <div class="boxNumber">${box.id}</div>
        <div class="seatPill">
          <div class="seatName">${box.name || ''}</div>
          <div class="seatMeta">
            <span class="seatTime">${box.time || '00:00:00'}</span>
          </div>
        </div>
      </div>
    `;
    layer.appendChild(el);
  });
}

/* ================== WIRES ================== */
document.getElementById('backToDashboard')?.addEventListener('click', backToDashboard);

// expose for dashboard cards
window.openSection = openSection;
