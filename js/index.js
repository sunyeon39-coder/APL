console.log("🔥 index.js loaded");

const root = document.getElementById("indexRoot");

/* ===============================
   테스트 이벤트 데이터
=============================== */
const events = [
  {
    id: "event_1",
    boxId: "box_1",
    date: "2026-02-11",
    title: "#52 Closer Event – Monster Stack",
    start: "21:50",
    close: "22:20"
  },
  {
    id: "event_2",
    boxId: "box_2",
    date: "2026-02-11",
    title: "King's Debut Open DAY 1/C",
    start: "21:30",
    close: "21:33"
  },
  {
    id: "event_3",
    boxId: "box_3",
    date: "2026-02-11",
    title: "Mini Main Day-1E",
    start: "22:10",
    close: "23:00"
  }
];

/* ===============================
   UTIL
=============================== */
function parseDateTime(date, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

function formatDateTitle(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric"
  });
}

/* ===============================
   STATUS
=============================== */
function calcStatus(card) {
  const now = new Date();
  const date = card.dataset.date;
  const start = parseDateTime(date, card.dataset.start);
  const close = parseDateTime(date, card.dataset.close);

  const pill = card.querySelector(".pill");

  card.classList.remove("scheduled", "opened", "running", "closed");

  const openTime = new Date(start.getTime() - 30 * 60 * 1000);

  if (now < openTime) {

    card.classList.add("scheduled");
    pill.textContent = "SCHEDULED";
    pill.className = "pill scheduled";

  } else if (now >= openTime && now < start) {

    card.classList.add("opened");
    pill.textContent = "OPENED";
    pill.className = "pill opened";

  } else if (now >= start && now < close) {

    card.classList.add("running");
    pill.textContent = "RUNNING";
    pill.className = "pill running";

  } else {

    card.classList.add("closed");
    pill.textContent = "CLOSED";
    pill.className = "pill closed";
  }
}

/* ===============================
   RENDER
=============================== */
function render() {
  root.innerHTML = "";

  const grouped = {};

  events.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  Object.entries(grouped).forEach(([date, list]) => {

    const header = document.createElement("div");
    header.className = "date-header";
    header.innerHTML = `
      <div class="date-title">${formatDateTitle(date)}</div>
      <div class="date-count">${list.length} events</div>
    `;
    root.appendChild(header);

    list.forEach(e => {

      const card = document.createElement("div");
      card.className = "event-card";
      card.dataset.date = e.date;
      card.dataset.start = e.start;
      card.dataset.close = e.close;
      card.dataset.eventId = e.id;
      card.dataset.boxId = e.boxId;

      card.innerHTML = `
        <div class="event-header">
          <div class="event-title">${e.title}</div>
          <span class="pill"></span>
        </div>

        <div class="event-info">
          <div class="info-box">
            <div class="info-label">Time</div>
            ${e.start}
          </div>

          <div class="info-box">
            <div class="info-label">Reg Closes</div>
            ${e.close}
          </div>

          <div class="info-box">
            <div class="info-label">Table</div>
            <div class="entries-table">Seats Table</div>
          </div>
        </div>
      `;

      root.appendChild(card);
      calcStatus(card);
    });
  });
}

/* ===============================
   CLICK → LAYOUT
=============================== */
root.addEventListener("click", (e) => {
  const card = e.target.closest(".event-card");
  if (!card) return;

  const eventId = card.dataset.eventId;
  const boxId = card.dataset.boxId;

  if (!eventId || !boxId) {
    console.warn("❌ Missing eventId or boxId");
    return;
  }

  console.log("👉 Go Layout:", eventId, boxId);

// ✅ (2번) 백업 저장
sessionStorage.setItem("eventId", eventId);
sessionStorage.setItem("boxId", boxId);

// ✅ 인코딩까지 같이 (안전)
location.href =
  `layout.html?eventId=${encodeURIComponent(eventId)}&boxId=${encodeURIComponent(boxId)}`;
});

/* ===============================
   INIT
=============================== */
render();

setInterval(() => {
  document.querySelectorAll(".event-card").forEach(calcStatus);
}, 1000);
