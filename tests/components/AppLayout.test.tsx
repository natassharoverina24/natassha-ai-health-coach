import { render } from "@testing-library/react";

import AppLayout from "@/app/(app)/layout";
import { useAuth } from "@/contexts/AuthContext";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("authenticated route guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not redirect to login while auth is initializing", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      authInitializing: true,
      loading: true,
    });

    render(
      <AppLayout>
        <div>Private page</div>
      </AppLayout>,
    );

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects only after auth resolves without a user", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      authInitializing: false,
      loading: false,
    });

    render(
      <AppLayout>
        <div>Private page</div>
      </AppLayout>,
    );

    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
