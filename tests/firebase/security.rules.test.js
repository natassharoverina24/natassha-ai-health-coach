/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getBytes,
  ref,
  uploadBytes,
} from "firebase/storage";

const PROJECT_ID = "demo-natassha-health-coach";
const OWNER_ID = "owner-user";
const OTHER_ID = "other-user";
const PRODUCTION_OWNER_ID = "Qkdwr5Jl9pe3LW6aeftVcFFkwdb2";
const PRODUCTION_DATE = "2026-07-30";
const PRODUCTION_ACTIVE_DISRUPTION_PATH =
  `active_disruptions/${PRODUCTION_OWNER_ID}__${PRODUCTION_DATE}`;
const MEAL_PATH = "meals/owned-meal";
const TIMELINE_COMPLETION_PATH =
  "timeline_completions/owner-user__2026-07-29__sleepPreparation";
const ACTIVE_DISRUPTION_PATH =
  "active_disruptions/owner-user__2026-07-29";
const PHOTO_PATH = `users/${OWNER_ID}/meal_photos/meal.jpg`;
const REPORT_PATH = `users/${OWNER_ID}/reports/report.pdf`;

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.resolve(__dirname, "../../firestore.rules"),
        "utf8",
      ),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync(
        path.resolve(__dirname, "../../storage.rules"),
        "utf8",
      ),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

function firestoreFor(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

function storageFor(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).storage()
    : testEnv.unauthenticatedContext().storage();
}

async function seedOwnedMeal() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), MEAL_PATH), {
      userId: OWNER_ID,
      name: "Synthetic meal",
    });
  });
}

function activeDisruptionPayload(type, details = {}) {
  return {
    userId: OWNER_ID,
    date: "2026-07-29",
    type,
    startedAt: "2026-07-29T08:00:00.000Z",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...details,
  };
}

describe("Firestore ownership rules", () => {
  test("production owner creates exact feeling-unwell payload", async () => {
    await assertSucceeds(
      setDoc(
        doc(
          firestoreFor(PRODUCTION_OWNER_ID),
          PRODUCTION_ACTIVE_DISRUPTION_PATH,
        ),
        {
          userId: PRODUCTION_OWNER_ID,
          date: PRODUCTION_DATE,
          type: "feeling-unwell",
          status: "active",
          startedAt: "2026-07-30T12:00:00.000Z",
        },
      ),
    );
  });

  test("another user cannot create the production disruption payload", async () => {
    await assertFails(
      setDoc(
        doc(
          firestoreFor(OTHER_ID),
          PRODUCTION_ACTIVE_DISRUPTION_PATH,
        ),
        {
          userId: PRODUCTION_OWNER_ID,
          date: PRODUCTION_DATE,
          type: "feeling-unwell",
          status: "active",
          startedAt: "2026-07-30T12:00:00.000Z",
        },
      ),
    );
  });

  test("production owner can clear the same disruption", async () => {
    const ownerRef = doc(
      firestoreFor(PRODUCTION_OWNER_ID),
      PRODUCTION_ACTIVE_DISRUPTION_PATH,
    );
    await assertSucceeds(
      setDoc(ownerRef, {
        userId: PRODUCTION_OWNER_ID,
        date: PRODUCTION_DATE,
        type: "feeling-unwell",
        status: "active",
        startedAt: "2026-07-30T12:00:00.000Z",
      }),
    );

    await assertSucceeds(
      updateDoc(ownerRef, {
        status: "cleared",
        clearedAt: "2026-07-30T13:00:00.000Z",
      }),
    );
  });

  test("active disruption doc id must match owner and date", async () => {
    await assertFails(
      setDoc(
        doc(
          firestoreFor(PRODUCTION_OWNER_ID),
          "active_disruptions/wrong-id",
        ),
        {
          userId: PRODUCTION_OWNER_ID,
          date: PRODUCTION_DATE,
          type: "feeling-unwell",
          status: "active",
          startedAt: "2026-07-30T12:00:00.000Z",
        },
      ),
    );
  });

  test.each([
    ["working-late", { expectedEndAt: "21:00" }],
    ["migraine", {}],
    ["feeling-unwell", {}],
    ["pms", {}],
    ["travelling", { affectedSlot: "lunch" }],
    ["event-or-reception", { affectedMealSlot: "dinner" }],
    ["missed-workout", {}],
    [
      "skipped-meal",
      { skippedMealSlot: "breakfast", skippedAt: "08:00" },
    ],
  ])("owner creates exact %s disruption payload", async (type, details) => {
    const ownerRef = doc(
      firestoreFor(OWNER_ID),
      ACTIVE_DISRUPTION_PATH,
    );
    await assertSucceeds(
      setDoc(ownerRef, activeDisruptionPayload(type, details)),
    );
  });

  test("feeling-unwell rejects irrelevant optional fields", async () => {
    await assertFails(
      setDoc(
        doc(firestoreFor(OWNER_ID), ACTIVE_DISRUPTION_PATH),
        activeDisruptionPayload("feeling-unwell", {
          affectedSlot: null,
        }),
      ),
    );
  });

  test("active disruption remains owner-only and can be cleared", async () => {
    const ownerRef = doc(
      firestoreFor(OWNER_ID),
      ACTIVE_DISRUPTION_PATH,
    );
    await assertSucceeds(
      setDoc(ownerRef, activeDisruptionPayload("feeling-unwell")),
    );
    await assertSucceeds(getDoc(ownerRef));
    const otherRef = doc(
      firestoreFor(OTHER_ID),
      ACTIVE_DISRUPTION_PATH,
    );
    await assertFails(getDoc(otherRef));
    await assertFails(updateDoc(otherRef, { status: "cleared" }));
    await assertFails(
      setDoc(doc(firestoreFor(OTHER_ID), ACTIVE_DISRUPTION_PATH), {
        ...activeDisruptionPayload("pms"),
      }),
    );
    await assertSucceeds(
      updateDoc(ownerRef, {
        status: "cleared",
        clearedAt: "2026-07-29T09:00:00.000Z",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("timeline completion remains owner-only", async () => {
    await assertSucceeds(
      setDoc(
        doc(firestoreFor(OWNER_ID), TIMELINE_COMPLETION_PATH),
        {
          userId: OWNER_ID,
          date: "2026-07-29",
          itemId: "2026-07-29:sleepPreparation",
        },
      ),
    );
    await assertFails(
      getDoc(doc(firestoreFor(OTHER_ID), TIMELINE_COMPLETION_PATH)),
    );
  });

  test("owner creates a document with matching userId", async () => {
    await assertSucceeds(
      setDoc(doc(firestoreFor(OWNER_ID), MEAL_PATH), {
        userId: OWNER_ID,
        name: "Synthetic meal",
      }),
    );
  });

  test("create with another userId is denied", async () => {
    await assertFails(
      setDoc(doc(firestoreFor(OWNER_ID), MEAL_PATH), {
        userId: OTHER_ID,
        name: "Synthetic meal",
      }),
    );
  });

  test("owner updates without changing userId", async () => {
    await seedOwnedMeal();
    await assertSucceeds(
      updateDoc(doc(firestoreFor(OWNER_ID), MEAL_PATH), {
        name: "Updated synthetic meal",
      }),
    );
  });

  test("owner cannot change userId", async () => {
    await seedOwnedMeal();
    await assertFails(
      updateDoc(doc(firestoreFor(OWNER_ID), MEAL_PATH), {
        userId: OTHER_ID,
      }),
    );
  });

  test("another authenticated user cannot read, update, or delete", async () => {
    await seedOwnedMeal();
    const otherMeal = doc(firestoreFor(OTHER_ID), MEAL_PATH);

    await assertFails(getDoc(otherMeal));
    await assertFails(updateDoc(otherMeal, { name: "Forbidden update" }));
    await assertFails(deleteDoc(otherMeal));
  });

  test("unauthenticated access is denied", async () => {
    await seedOwnedMeal();
    const unauthenticatedMeal = doc(firestoreFor(null), MEAL_PATH);

    await assertFails(getDoc(unauthenticatedMeal));
    await assertFails(
      setDoc(doc(firestoreFor(null), "meals/new-meal"), {
        userId: OWNER_ID,
      }),
    );
    await assertFails(
      updateDoc(unauthenticatedMeal, { name: "Forbidden update" }),
    );
    await assertFails(deleteDoc(unauthenticatedMeal));
  });
});

describe("Storage ownership and content rules", () => {
  test("owner uploads an image below 10 MiB", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(storageFor(OWNER_ID), PHOTO_PATH),
        Buffer.from("synthetic-image"),
        { contentType: "image/jpeg" },
      ),
    );
  });

  test("non-image upload is denied for meal photos", async () => {
    await assertFails(
      uploadBytes(
        ref(storageFor(OWNER_ID), PHOTO_PATH),
        Buffer.from("synthetic-text"),
        { contentType: "text/plain" },
      ),
    );
  });

  test("image above 10 MiB is denied", async () => {
    await assertFails(
      uploadBytes(
        ref(storageFor(OWNER_ID), PHOTO_PATH),
        Buffer.alloc(10 * 1024 * 1024 + 1),
        { contentType: "image/jpeg" },
      ),
    );
  });

  test("unauthenticated upload is denied", async () => {
    await assertFails(
      uploadBytes(
        ref(storageFor(null), PHOTO_PATH),
        Buffer.from("synthetic-image"),
        { contentType: "image/jpeg" },
      ),
    );
  });

  test("another user cannot overwrite the owner's object", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(storageFor(OWNER_ID), PHOTO_PATH),
        Buffer.from("owner-image"),
        { contentType: "image/jpeg" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(storageFor(OTHER_ID), PHOTO_PATH),
        Buffer.from("other-image"),
        { contentType: "image/jpeg" },
      ),
    );
  });

  test("report storage remains owner-only and accepts non-image content", async () => {
    const ownerReport = ref(storageFor(OWNER_ID), REPORT_PATH);
    await assertSucceeds(
      uploadBytes(ownerReport, Buffer.from("synthetic-report"), {
        contentType: "application/pdf",
      }),
    );
    await assertSucceeds(getBytes(ownerReport));
    await assertFails(getBytes(ref(storageFor(OTHER_ID), REPORT_PATH)));
  });
});
