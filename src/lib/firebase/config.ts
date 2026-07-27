/**
 * Firebase App Initialization
 * ---------------------------------------------------------------------------
 * The only file that should call `initializeApp`. Every other module in
 * src/lib/firebase imports `app`, `auth`, `db`, `storage`, `messaging` from
 * here. Guards against the "duplicate app" error that Next.js hot-reload and
 * SSR/CSR double-invocation otherwise cause.
 */
import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import {
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const rawFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigIsPresent = Boolean(
  rawFirebaseConfig.apiKey && rawFirebaseConfig.projectId,
);

/**
 * Firebase's SDKs (especially `getAuth`) validate the config shape eagerly
 * at initialization time and throw synchronously if `apiKey` is missing or
 * malformed. That happens at *import* time, which means it fires during
 * `next build`'s static prerendering of every page that transitively
 * imports the root layout (including framework pages like `/_not-found`)
 * — long before any component actually tries to sign a user in.
 *
 * To keep builds and previews working before real credentials are wired
 * up (CI, first clone, etc.), we fall back to syntactically-valid demo
 * values. Every real Firebase network call will still fail loudly at
 * runtime with a clear, actionable error — this only prevents a missing
 * `.env.local` from taking down the entire build.
 */
const firebaseConfig = firebaseConfigIsPresent
  ? rawFirebaseConfig
  : {
      apiKey: "demo-api-key-not-configured",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000",
      measurementId: undefined,
    };

function warnIfMisconfigured() {
  if (firebaseConfigIsPresent || process.env.NODE_ENV === "test") return;
  console.warn(
    "[firebase] No Firebase project configured — running with placeholder credentials. " +
      "Copy .env.local.example to .env.local and fill in your Firebase project credentials " +
      "before signing in or reading/writing any real data.",
  );
}

warnIfMisconfigured();

export const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

/**
 * Firestore is initialized with persistent (IndexedDB) local cache and
 * multi-tab synchronization, which is what gives us offline read/write
 * support and automatic sync across tabs once connectivity returns.
 *
 * `initializeFirestore` throws if called twice for the same app, which
 * happens routinely under Next.js Fast Refresh — so we defensively fall
 * back to a cached instance stored on `globalThis`.
 */
declare global {
  var __NATASSHA_FIRESTORE__: Firestore | undefined;
}

function createFirestore(): Firestore {
  if (typeof window === "undefined") {
    // Server-side (SSR/build): plain Firestore instance, no persistence.
    // `initializeFirestore` still requires dynamic import guards in some
    // environments, but the JS SDK is safe to call here without a cache.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase/firestore");
    return getFirestore(app);
  }

  if (globalThis.__NATASSHA_FIRESTORE__) {
    return globalThis.__NATASSHA_FIRESTORE__;
  }

  const instance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });

  globalThis.__NATASSHA_FIRESTORE__ = instance;
  return instance;
}

export const db: Firestore = createFirestore();

export const storage: FirebaseStorage = getStorage(app);
