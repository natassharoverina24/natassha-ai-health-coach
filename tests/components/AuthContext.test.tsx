import { render, waitFor } from "@testing-library/react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  completeGoogleRedirectSignIn,
  onAuthStateChanged,
} from "@/lib/firebase/auth";

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
  const { loading, error } = useAuth();
  return (
    <div>
      <span>{loading ? "loading" : "ready"}</span>
      <span>{error ?? "no-error"}</span>
    </div>
  );
}

describe("AuthProvider redirect restoration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles the redirect result before observing auth state on app load", async () => {
    (completeGoogleRedirectSignIn as jest.Mock).mockResolvedValue(null);
    (onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(completeGoogleRedirectSignIn).toHaveBeenCalledTimes(1);
      expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    });
    expect(
      (completeGoogleRedirectSignIn as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan((onAuthStateChanged as jest.Mock).mock.invocationCallOrder[0]);
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
