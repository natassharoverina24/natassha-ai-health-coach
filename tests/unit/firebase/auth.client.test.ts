const signInWithPopupMock = jest.fn();
const signInWithRedirectMock = jest.fn();
const getRedirectResultMock = jest.fn();
const setPersistenceMock = jest.fn();

jest.mock("@/lib/firebase/config", () => ({
  auth: { currentUser: null },
}));

jest.mock("firebase/auth", () => ({
  browserLocalPersistence: { type: "LOCAL" },
  browserSessionPersistence: { type: "SESSION" },
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    setCustomParameters: jest.fn(),
  })),
  getIdToken: jest.fn(),
  getRedirectResult: (...args: unknown[]) => getRedirectResultMock(...args),
  indexedDBLocalPersistence: { type: "INDEXEDDB" },
  inMemoryPersistence: { type: "NONE" },
  onAuthStateChanged: jest.fn(),
  setPersistence: (...args: unknown[]) => setPersistenceMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirectMock(...args),
  signOut: jest.fn(),
}));

import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import {
  completeGoogleRedirectSignIn,
  GOOGLE_SIGN_IN_FRIENDLY_ERROR,
  shouldUseGoogleRedirect,
  signInWithGoogle,
} from "@/lib/firebase/auth";

function setBrowser(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe("Google sign-in browser flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPersistenceMock.mockResolvedValue(undefined);
    setBrowser(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
    );
  });

  it("uses popup on a desktop browser", async () => {
    const user = { uid: "desktop-user" };
    signInWithPopupMock.mockResolvedValue({ user });
    const consoleInfo = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(signInWithGoogle()).resolves.toBe(user);
    expect(setPersistenceMock).toHaveBeenCalledWith(
      expect.any(Object),
      browserLocalPersistence,
    );
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(signInWithRedirectMock).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledWith("[Auth] flow selected", {
      flow: "popup",
      code: "auth/ok",
      message: "desktop-popup",
    });
    consoleInfo.mockRestore();
  });

  it("uses redirect on iPhone Safari", async () => {
    setBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      5,
    );
    signInWithRedirectMock.mockResolvedValue(undefined);
    const consoleInfo = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(setPersistenceMock).toHaveBeenCalledWith(
      expect.any(Object),
      browserLocalPersistence,
    );
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
    expect(signInWithPopupMock).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledWith("[Auth] flow selected", {
      flow: "redirect",
      code: "auth/ok",
      message: "mobile-redirect",
    });
    expect(JSON.stringify(consoleInfo.mock.calls)).not.toMatch(
      /token|credential|api[_-]?key/i,
    );
    consoleInfo.mockRestore();
  });

  it("recognizes iPadOS desktop-style user agents", () => {
    expect(
      shouldUseGoogleRedirect(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15",
        5,
      ),
    ).toBe(true);
  });

  it("falls back to session persistence when local storage is unavailable", async () => {
    setBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      5,
    );
    setPersistenceMock
      .mockRejectedValueOnce(new Error("local unavailable"))
      .mockResolvedValueOnce(undefined);
    signInWithRedirectMock.mockResolvedValue(undefined);

    await expect(signInWithGoogle()).resolves.toBeNull();

    expect(setPersistenceMock.mock.calls.map((call) => call[1])).toEqual([
      browserLocalPersistence,
      browserSessionPersistence,
    ]);
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
  });

  it("does not start a redirect when only in-memory persistence is available", async () => {
    setBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      5,
    );
    setPersistenceMock
      .mockRejectedValueOnce(new Error("local unavailable"))
      .mockRejectedValueOnce(new Error("session unavailable"))
      .mockRejectedValueOnce(new Error("indexeddb unavailable"))
      .mockResolvedValueOnce(undefined);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(signInWithGoogle()).rejects.toThrow(
      GOOGLE_SIGN_IN_FRIENDLY_ERROR,
    );

    expect(setPersistenceMock.mock.calls.map((call) => call[1])).toEqual([
      browserLocalPersistence,
      browserSessionPersistence,
      indexedDBLocalPersistence,
      inMemoryPersistence,
    ]);
    expect(signInWithRedirectMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("completes redirect results after the app loads", async () => {
    const user = { uid: "redirect-user" };
    getRedirectResultMock.mockResolvedValue({ user });
    const consoleInfo = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(completeGoogleRedirectSignIn()).resolves.toBe(user);
    await expect(completeGoogleRedirectSignIn()).resolves.toBe(user);
    expect(getRedirectResultMock).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledWith(
      "[Auth] redirect result checked",
      {
        flow: "redirect",
        code: "auth/ok",
        message: "user-restored",
      },
    );
    consoleInfo.mockRestore();
  });

  it("sanitizes Firebase failures and does not expose the raw message", async () => {
    signInWithPopupMock.mockRejectedValue({
      code: "auth/internal-error",
      message: "https://firebase.google.com/raw-secret-detail",
    });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(signInWithGoogle()).rejects.toThrow(
      GOOGLE_SIGN_IN_FRIENDLY_ERROR,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[Auth] sign-in failed",
      expect.objectContaining({
        flow: "popup",
        code: "auth/internal-error",
        message: GOOGLE_SIGN_IN_FRIENDLY_ERROR,
      }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "raw-secret-detail",
    );
    consoleError.mockRestore();
  });
});
