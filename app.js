
/**
 * Box Board – SAFE patched version
 * Fixes null addEventListener errors by guarding bindings
 */

function safeBind(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(event, handler);
}

/* Sidebar */
function toggleSidebar() {
  const side = document.getElementById('sidePanel');
  if (!side) return;
  side.classList.toggle('collapsed');
}

/* Bind board-only controls */
function bindBoardEvents() {
  safeBind('toggleSide', 'click', toggleSidebar);
  safeBind('alignH', 'click', () => {});
  safeBind('alignV', 'click', () => {});
  safeBind('spaceH', 'click', () => {});
  safeBind('spaceV', 'click', () => {});
  safeBind('zoomIn', 'click', () => {});
  safeBind('zoomOut', 'click', () => {});
  safeBind('zoomReset', 'click', () => {});
  safeBind('addBox', 'click', () => {});
  safeBind('deleteSelected', 'click', () => {});
}

/* Navigation */
function openSection(sectionId) {
  document.getElementById('dashboardView')?.classList.add('hidden');
  document.getElementById('appRoot')?.classList.remove('hidden');
  bindBoardEvents();
}

function backToDashboard() {
  document.getElementById('appRoot')?.classList.add('hidden');
  document.getElementById('dashboardView')?.classList.remove('hidden');
}

/* Expose */
window.openSection = openSection;

/* Back button */
safeBind('backToDashboard', 'click', backToDashboard);
