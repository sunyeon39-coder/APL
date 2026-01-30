const tournamentListEl = document.getElementById("tournamentList");
const tournamentEmptyEl = document.getElementById("tournamentEmpty");

const createEventBtn = document.getElementById("createEventBtn");
const eventModal = document.getElementById("eventModal");
const eventSaveBtn = document.getElementById("eventSaveBtn");
const eventCancelBtn = document.getElementById("eventCancelBtn");

const eventName = document.getElementById("eventName");
const eventLocation = document.getElementById("eventLocation");
const eventStart = document.getElementById("eventStart");
const eventEnd = document.getElementById("eventEnd");

let tournaments = [];

/* RENDER */
function renderTournaments(){
  tournamentListEl.innerHTML = "";

  if(tournaments.length === 0){
    tournamentEmptyEl.classList.remove("hidden");
    return;
  }

  tournamentEmptyEl.classList.add("hidden");

  tournaments.forEach(t => {
    const row = document.createElement("div");
    row.className = "tournament-row";
    row.innerHTML = `
      <h3>${t.name}</h3>
      <div class="location">${t.location}</div>
      <div class="date">${t.start} ~ ${t.end}</div>
    `;
    tournamentListEl.appendChild(row);
  });
}

/* CREATE EVENT */
createEventBtn.onclick = () => {
  eventModal.classList.remove("hidden");
};

eventCancelBtn.onclick = () => {
  eventModal.classList.add("hidden");
};

eventSaveBtn.onclick = () => {
  if(!eventName.value) return alert("대회명을 입력하세요");

  tournaments.push({
    name: eventName.value,
    location: eventLocation.value,
    start: eventStart.value,
    end: eventEnd.value
  });

  eventModal.classList.add("hidden");
  eventName.value = "";
  eventLocation.value = "";
  eventStart.value = "";
  eventEnd.value = "";

  renderTournaments();
};

/* INIT */
renderTournaments();
