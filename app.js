const waitList = document.getElementById("waitList");
const board = document.getElementById("board");
const nameInput = document.getElementById("nameInput");

let zoom = 1;

/* ADD WAIT ITEM */
document.getElementById("addBtn").onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;

  const item = document.createElement("div");
  item.className = "wait-item";
  item.draggable = true;

  const label = document.createElement("div");
  label.textContent = name;

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = "대기 00:00:00";

  const del = document.createElement("button");
  del.className = "delete";
  del.textContent = "삭제";
  del.onclick = () => item.remove();

  item.append(label, time, del);
  waitList.appendChild(item);

  item.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", name);
    item.classList.add("dragging");
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
  });

  nameInput.value = "";
};

/* DROP TO BOARD */
board.addEventListener("dragover", e => e.preventDefault());

board.addEventListener("drop", e => {
  e.preventDefault();
  const name = e.dataTransfer.getData("text/plain");
  if (!name) return;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="title">${name}</div>`;
  card.draggable = true;

  board.appendChild(card);

  [...waitList.children].forEach(w => {
    if (w.firstChild.textContent === name) w.remove();
  });
});

/* ZOOM */
document.getElementById("zoomIn").onclick = () => {
  zoom = Math.min(1.5, zoom + 0.1);
  applyZoom();
};
document.getElementById("zoomOut").onclick = () => {
  zoom = Math.max(0.5, zoom - 0.1);
  applyZoom();
};
document.getElementById("resetZoom").onclick = () => {
  zoom = 1;
  applyZoom();
};

function applyZoom() {
  board.style.transform = `scale(${zoom})`;
  board.style.transformOrigin = "top left";
  document.getElementById("zoomValue").textContent =
    Math.round(zoom * 100) + "%";
}
