import { auth, db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM
=============================== */
const tableEl = document.getElementById("userTable");
const searchInput = document.getElementById("searchInput");
const roleFilter = document.getElementById("roleFilter");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let currentUserRole = null;
let allUsers = [];

/* ===============================
   AUTH CHECK (ADMIN ONLY)
=============================== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "/";
    return;
  }

  currentUser = user;

  try {
    const meRef = doc(db, "users", user.uid);
    const meSnap = await getDoc(meRef);

    if (!meSnap.exists() || meSnap.data().role !== "admin") {
      alert("Admins only");
      location.href = "/";
      return;
    }

    currentUserRole = "admin";
    listenUsers();

  } catch (err) {
    console.error("🔥 auth/role error", err);
  }
});

/* ===============================
   LISTEN USERS
=============================== */
function listenUsers() {
  onSnapshot(collection(db, "users"), snap => {
    allUsers = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    renderUsers();
  });
}

/* ===============================
   SEARCH / FILTER EVENTS
=============================== */
searchInput?.addEventListener("input", renderUsers);
roleFilter?.addEventListener("change", renderUsers);

/* ===============================
   RENDER USERS
=============================== */
function renderUsers() {
  const keyword = searchInput?.value.toLowerCase() || "";
  const role = roleFilter?.value || "all";

  tableEl.innerHTML = "";

  allUsers
    .filter(u => {
      const email = u.email?.toLowerCase() || "";
      const name = u.name?.toLowerCase() || "";

      const matchKeyword =
        email.includes(keyword) ||
        name.includes(keyword);

      const matchRole =
        role === "all" || u.role === role;

      return matchKeyword && matchRole;
    })
    .forEach(u => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${u.email || "-"}</td>
        <td>${u.name || "-"}</td>
        <td class="role ${u.role}">${u.role}</td>
        <td>
          ${
            u.id === currentUser.uid
              ? `<span style="opacity:.5">—</span>`
              : u.role === "admin"
                ? `<button class="demote">Demote</button>`
                : `<button class="promote">Promote</button>`
          }
        </td>
      `;

      const btn = tr.querySelector("button");

      if (btn) {
        btn.addEventListener("click", async () => {
          const newRole = u.role === "admin" ? "user" : "admin";

          if (!confirm(`Change role to ${newRole}?`)) return;

          try {
            await updateDoc(doc(db, "users", u.id), {
              role: newRole
            });
          } catch (err) {
            console.error("🔥 role update error", err);
            alert("Failed to update role");
          }
        });
      }

      tableEl.appendChild(tr);
    });
}
