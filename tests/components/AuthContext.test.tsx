import { render, waitFor } from "@testing-library/react";
import { act } from "react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  completeGoogleRedirectSignIn,
  onAuthStateChanged,
} from "@/lib/firebase/auth";
import { usersRepository } from "@/lib/db/users.repository";

jest.mock("@/lib/firebase/auth", () => ({
  completeGoogleRedirectSignIn: jest.fn(),
  GOOGLE_SIGN_IN_FRIENDLY_ERROR:
    "Google sign-in could not be completed. Please try again.",
  onAuthStateChanged: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("@/lib/db/users.repository", () => ({
  usersRepository: {
    ensureProfile: jest.fn(),
    subscribeByUid: jest.fn(),
  },
}));

function AuthStateProbe() {
  const { user, authInitializing, loading, error } = useAuth();
  return (
    <div>
      <span>{authInitializing ? "auth-initializing" : "auth-ready"}</span>
      <span>{loading ? "loading" : "ready"}</span>
      <span>{user?.uid ?? "no-user"}</span>
      <span>{error ?? "no-error"}</span>
    </div>
  );
}

describe("AuthProvider redirect restoration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersRepository.ensureProfile as jest.Mock).mockResolvedValue({
      userId: "redirect-user",
    });
    (usersRepository.subscribeByUid as jest.Mock).mockReturnValue(jest.fn());
  });

  it("starts in initializing state and subscribes before checking redirect", async () => {
    let resolveRedirect!: (value: null) => void;
    (completeGoogleRedirectSignIn as jest.Mock).mockReturnValue(
      new Promise<null>((resolve) => {
        resolveRedirect = resolve;
      }),
    );
    (onAuthStateChanged as jest.Mock).mockImplementation(() => {
      return jest.fn();
    });

    const { container } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(container).toHaveTextContent("auth-initializing");
    await waitFor(() => {
      expect(completeGoogleRedirectSignIn).toHaveBeenCalledTimes(1);
      expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    });
    expect(
      (onAuthStateChanged as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (completeGoogleRedirectSignIn as jest.Mock).mock.invocationCallOrder[0],
    );
    await act(async () => resolveRedirect(null));
  });

  it("keeps initializing when redirect is null until auth state resolves", async () => {
    let authCallback!: (user: null) => void;
    let resolveRedirect!: (value: null) => void;
    (onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      authCallback = callback;
      return jest.fn();
    });
    (completeGoogleRedirectSignIn as jest.Mock).mockReturnValue(
      new Promise<null>((resolve) => {
        resolveRedirect = resolve;
      }),
    );

    const { container } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    act(() => authCallback(null));
    expect(container).toHaveTextContent("auth-initializing");
    await act(async () => resolveRedirect(null));
    await waitFor(() => expect(container).toHaveTextContent("auth-ready"));
    expect(container).toHaveTextContent("no-user");
  });

  it("uses the redirect result user even if initial auth state is null", async () => {
    const redirectUser = {
      uid: "redirect-user",
      email: null,
      photoURL: null,
      displayName: "Mobile User",
    };
    (onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });
    (completeGoogleRedirectSignIn as jest.Mock).mockResolvedValue(redirectUser);

    const { container } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(container).toHaveTextContent("redirect-user");
      expect(container).toHaveTextContent("auth-ready");
    });
    expect(usersRepository.ensureProfile).toHaveBeenCalledWith(
      "redirect-user",
      expect.objectContaining({ displayName: "Mobile User" }),
    );
  });

  it("uses the resolved auth-state user when there is no redirect result", async () => {
    const observedUser = {
      uid: "redirect-user",
      email: null,
      photoURL: null,
      displayName: "Observed User",
    };
    (completeGoogleRedirectSignIn as jest.Mock).mockResolvedValue(null);
    (onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(observedUser);
      return jest.fn();
    });

    const { container } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(container).toHaveTextContent("redirect-user");
      expect(container).toHaveTextContent("auth-ready");
    });
    expect(usersRepository.ensureProfile).toHaveBeenCalledWith(
      "redirect-user",
      expect.objectContaining({ displayName: "Observed User" }),
    );
  });

  it("shows a friendly redirect error without leaking Firebase details", async () => {
    (completeGoogleRedirectSignIn as jest.Mock).mockRejectedValue(
      new Error("https://firebase.google.com/raw-index-message"),
    );
    (onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });

    const { container } = render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(container).toHaveTextContent(
        "Google sign-in could not be completed. Please try again.",
      );
    });
    expect(container).not.toHaveTextContent("firebase.google.com");
  });
});
