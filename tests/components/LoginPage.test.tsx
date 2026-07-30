import { render, waitFor } from "@testing-library/react";

import LoginPage from "@/app/(auth)/login/page";
import { useAuth } from "@/contexts/AuthContext";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/firebase/config", () => ({
  firebaseConfigIsPresent: true,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes a successfully restored redirect session to the dashboard", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: "mobile-user" },
      authInitializing: false,
      loading: false,
      signInWithGoogle: jest.fn(),
      error: null,
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows only the friendly auth error", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      authInitializing: false,
      loading: false,
      signInWithGoogle: jest.fn(),
      error: "Google sign-in could not be completed. Please try again.",
    });

    const { container } = render(<LoginPage />);

    expect(container).toHaveTextContent(
      "Google sign-in could not be completed. Please try again.",
    );
    expect(container).not.toHaveTextContent("firebase");
    expect(container).not.toHaveTextContent("https://");
  });
});
