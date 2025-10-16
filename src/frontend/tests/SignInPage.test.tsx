import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignInPage from "../src/pages/SignInPage";

// Mock navigate so we don't change real location
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual: typeof import("react-router-dom") =
    await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock the API module so NO real API is used
const loginUserMock = vi.fn();
vi.mock("../src/api/auth", () => ({
  loginUser: (...args: unknown[]) => loginUserMock(...args),
}));

// Mock SignUpComponent to a simple visible stub
vi.mock("../src/components/SignUpComponent", () => ({
  default: (props: { onComplete?: () => void }) => (
    <div data-testid="signup-mock" onClick={props.onComplete}>
      SignUp Mock
    </div>
  ),
}));

describe("SignInPage (unit, no real APIs)", () => {
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

  it("disables Login until both fields are filled; enables after input", () => {
    renderPage();

    const userInput = screen.getByLabelText(/username or email/i);
    const passInput = screen.getByLabelText(/password/i);
    const loginBtn = screen.getByRole("button", { name: /login/i });

    expect(loginBtn).toBeDisabled();

    fireEvent.change(userInput, { target: { value: "user@example.com" } });
    expect(loginBtn).toBeDisabled(); // still disabled (no password)

    fireEvent.change(passInput, { target: { value: "Secret123!" } });
    expect(loginBtn).not.toBeDisabled();
  });

  it("navigates to /home on successful login", async () => {
    loginUserMock.mockResolvedValueOnce({ success: true });

    renderPage();

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Secret123!" },
    });

    fireEvent.submit(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(loginUserMock).toHaveBeenCalledWith(
        "user@example.com",
        "Secret123!"
      );
      expect(navigateMock).toHaveBeenCalledWith("/home");
    });
  });

});
