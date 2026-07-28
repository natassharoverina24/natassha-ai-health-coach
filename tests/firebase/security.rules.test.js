/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const { TextDecoder, TextEncoder } = require("node:util");
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require("node:stream/web");

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  WritableStream,
  TransformStream,
});

const {
  fetch,
  Headers,
  Request,
  Response,
} = require("undici");

Object.assign(globalThis, {
  fetch,
  Headers,
  Request,
  Response,
});

const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} = require("firebase/firestore");

const {
  ref,
  uploadBytes,
  deleteObject,
  getBytes,
} = require("firebase/storage");

const PROJECT_ID = "demo-natassha-health-coach";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync("storage.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe("Firestore ownership rules", () => {
  const ownerId = "owner-user";
  const otherId = "other-user";

  test("owner creates with matching userId", async () => {
    const db = testEnv.authenticatedContext(ownerId).firestore();

    await assertSucceeds(
      setDoc(doc(db, "cycles", "cycle-1"), {
        userId: ownerId,
        startDate: "2026-07-28",
      })
    );
  });

  test("create with another userId is denied", async () => {
    const db = testEnv.authenticatedContext(ownerId).firestore();

    await assertFails(
      setDoc(doc(db, "cycles", "cycle-1"), {
        userId: otherId,
        startDate: "2026-07-28",
      })
    );
  });

  test("owner updates without changing userId", async () => {
    const db = testEnv.authenticatedContext(ownerId).firestore();
    const cycleRef = doc(db, "cycles", "cycle-1");

    await assertSucceeds(
      setDoc(cycleRef, {
        userId: ownerId,
        startDate: "2026-07-28",
      })
    );

    await assertSucceeds(
      updateDoc(cycleRef, {
        startDate: "2026-07-29",
      })
    );
  });

  test("owner cannot change userId", async () => {
    const db = testEnv.authenticatedContext(ownerId).firestore();
    const cycleRef = doc(db, "cycles", "cycle-1");

    await assertSucceeds(
      setDoc(cycleRef, {
        userId: ownerId,
        startDate: "2026-07-28",
      })
    );

    await assertFails(
      updateDoc(cycleRef, {
        userId: otherId,
      })
    );
  });

  test("another user cannot read, update, or delete", async () => {
    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
    const otherDb = testEnv.authenticatedContext(otherId).firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "cycles", "cycle-1"), {
        userId: ownerId,
        startDate: "2026-07-28",
      })
    );

    const otherRef = doc(otherDb, "cycles", "cycle-1");

    await assertFails(getDoc(otherRef));
    await assertFails(updateDoc(otherRef, { startDate: "2026-07-30" }));
    await assertFails(deleteDoc(otherRef));
  });

  test("unauthenticated access is denied", async () => {
    const ownerDb = testEnv.authenticatedContext(ownerId).firestore();

    await assertSucceeds(
      setDoc(doc(ownerDb, "cycles", "cycle-1"), {
        userId: ownerId,
        startDate: "2026-07-28",
      })
    );

    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(publicDb, "cycles", "cycle-1")));
    await assertFails(
      setDoc(doc(publicDb, "cycles", "cycle-2"), {
        userId: ownerId,
      })
    );
  });
});

describe("Storage ownership and upload rules", () => {
  const ownerId = "owner-user";
  const otherId = "other-user";

  test("owner uploads an image below 10 MiB", async () => {
    const storage = testEnv.authenticatedContext(ownerId).storage();
    const fileRef = ref(storage, `users/${ownerId}/meal_photos/photo.jpg`);

    await assertSucceeds(
      uploadBytes(fileRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/jpeg",
      })
    );
  });

  test("non-image meal photo upload is denied", async () => {
    const storage = testEnv.authenticatedContext(ownerId).storage();
    const fileRef = ref(storage, `users/${ownerId}/meal_photos/file.txt`);

    await assertFails(
      uploadBytes(fileRef, new Uint8Array([1, 2, 3]), {
        contentType: "text/plain",
      })
    );
  });

  test("image above 10 MiB is denied", async () => {
    const storage = testEnv.authenticatedContext(ownerId).storage();
    const fileRef = ref(storage, `users/${ownerId}/meal_photos/large.jpg`);
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);

    await assertFails(
      uploadBytes(fileRef, oversized, {
        contentType: "image/jpeg",
      })
    );
  });

  test("unauthenticated upload is denied", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    const fileRef = ref(storage, `users/${ownerId}/meal_photos/photo.jpg`);

    await assertFails(
      uploadBytes(fileRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/jpeg",
      })
    );
  });

  test("another user cannot overwrite owner's image", async () => {
    const ownerStorage = testEnv.authenticatedContext(ownerId).storage();
    const ownerRef = ref(
      ownerStorage,
      `users/${ownerId}/meal_photos/photo.jpg`
    );

    await assertSucceeds(
      uploadBytes(ownerRef, new Uint8Array([1, 2, 3]), {
        contentType: "image/jpeg",
      })
    );

    const otherStorage = testEnv.authenticatedContext(otherId).storage();
    const otherRef = ref(
      otherStorage,
      `users/${ownerId}/meal_photos/photo.jpg`
    );

    await assertFails(
      uploadBytes(otherRef, new Uint8Array([4, 5, 6]), {
        contentType: "image/jpeg",
      })
    );
  });

  test("owner report accepts non-image content and remains owner-only", async () => {
    const ownerStorage = testEnv.authenticatedContext(ownerId).storage();
    const reportPath = `users/${ownerId}/reports/report.pdf`;
    const ownerRef = ref(ownerStorage, reportPath);

    await assertSucceeds(
      uploadBytes(ownerRef, new Uint8Array([1, 2, 3]), {
        contentType: "application/pdf",
      })
    );

    await assertSucceeds(getBytes(ownerRef));

    const otherStorage = testEnv.authenticatedContext(otherId).storage();
    const otherRef = ref(otherStorage, reportPath);

    await assertFails(getBytes(otherRef));
    await assertFails(deleteObject(otherRef));
  });
});
