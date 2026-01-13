const waitingList = document.getElementById("waitingList");
const board = document.getElementById("board");
const addBtn = document.getElementById("addBtn");
const nameInput = document.getElementById("nameInput");

let selectedCards = new Set();
let selectMode = true;
let id = 1;

addBtn.onclick = () => {
  if (!nameInput.value.trim()) return;

  const li = document.createElement("li");
  li.className = "waiting-item";
  li.draggable = true;
  li.dataset.id = id++;

  li.innerHTML = `
    <div>
      <strong>${nameInput.value}</strong><br/>
      <span class="timer">대기 00:00</span>
    </div>
    <button>삭제</button>
  `;

  li.querySelector("button").onclick = () => li.remove();

  li.ondragstart = e => {
    e.dataTransfer.setData("text/plain", li.dataset.id);
    li.classList.add("dragging");
  };

  waitingList.appendChild(li);
  nameInput.value = "";
};

board.ondragover = e => e.preventDefault();

board.ondrop = e => {
  e.preventDefault();
  const dragged = document.querySelector(".dragging");
  if (!dragged) return;

  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;

  card.innerHTML = `
    <h3>${dragged.querySelector("strong").innerText}</h3>
    <div class="timer">대기 00:00</div>
  `;

  card.onclick = ev => {
    if (!selectMode) return;

    if (!ev.shiftKey) {
      selectedCards.forEach(c => c.classList.remove("selected"));
      selectedCards.clear();
    }

    card.classList.toggle("selected");

    if (selectedCards.has(card)) {
      selectedCards.delete(card);
    } else {
      selectedCards.add(card);
    }
    .card.selected {
  outline: 2px solid #ff6b6b;
  box-shadow: 0 0 12px rgba(255,107,107,0.6);
}

  };

  board.appendChild(card);
  dragged.remove();
};

document.addEventListener("keydown", e => {
  if (e.key === "Delete") {
    selectedCards.forEach(card => card.remove());
    selectedCards.clear();
  }
});

}, 1000);
