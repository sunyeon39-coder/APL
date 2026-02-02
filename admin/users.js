import { auth, db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tableEl = document.getElementById("userTable");

let currentUserRole = null;

/* ================= AUTH CHECK ================= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "/";
    return;
  }

  const me = await getDoc(doc(db, "users", user.uid));
  if (!me.exists() || me.data().role !== "admin") {
    alert("Admins only");
    location.href = "/";
    return;
  }

  currentUserRole = "admin";
  listenUsers();
});

/* ================= USERS LIST ================= */

function listenUsers() {
  onSnapshot(collection(db, "users"), snap => {
    tableEl.innerHTML = "";

    snap.forEach(d => {
      const u = d.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${u.email}</td>
        <td class="role ${u.role}">${u.role}</td>
        <td>
          ${u.role === "admin"
            ? `<button class="demote">Demote</button>`
            : `<button class="promote">Promote</button>`
          }
        </td>
      `;

      const btn = tr.querySelector("button");
      btn.addEventListener("click", async () => {
        const newRole = u.role === "admin" ? "user" : "admin";

        if (!confirm(`Change role to ${newRole}?`)) return;

        await updateDoc(doc(db, "users", d.id), {
          role: newRole
        });
      });

      tableEl.appendChild(tr);
    });
  });
}
