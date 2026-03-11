const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.pushSeatAssigned = onDocumentWritten("layout_notifications/{uid}", async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  if (after.type !== "seat_assigned") return;
  if (after.acknowledged === true) return;

  const uid = event.params.uid;
  const db = admin.firestore();

  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return;

  const user = userSnap.data() || {};
  const token = user.fcmWebToken;

  if (!token) {
    console.log("No fcmWebToken for user:", uid);
    return;
  }

  try {
    await admin.messaging().send({
      token,
      notification: {
        title: "BoxBoard",
        body: after.message || `Seat ${after.seatLabel || ""}에 배치되었습니다.`
      },
      data: {
        type: "seat_assigned",
        uid: String(uid),
        seatId: String(after.seatId || ""),
        seatLabel: String(after.seatLabel || ""),
        eventId: String(after.eventId || ""),
        boxId: String(after.boxId || ""),
        targetUrl: String(after.targetUrl || "./layout.html"),
        message: String(after.message || "")
      },
      webpush: {
        fcmOptions: {
          link: String(after.targetUrl || "./layout.html")
        }
      }
    });

    console.log("Push sent to:", uid);
  } catch (err) {
    console.error("pushSeatAssigned error:", err);
  }
});