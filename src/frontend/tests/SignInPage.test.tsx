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

// --- API mocks: loginUser + me + refresh ---
const loginUserMock = vi.fn();
const meMock = vi.fn<() => Promise<{ authenticated: boolean }>>();
const refreshMock = vi.fn<() => Promise<{ refreshed: boolean }>>();

vi.mock("../src/api/auth", () => ({
  loginUser: (...args: unknown[]) => loginUserMock(...args),
  me: () => meMock(),
  refresh: () => refreshMock(),
}));

// Mock SignUpComponent to a simple stub
vi.mock("../src/components/SignUpComponent", () => ({
  default: (props: { onComplete?: () => void }) => (
    <div data-testid="signup-mock" onClick={props.onComplete}>
      SignUp Mock
    </div>
  ),
}));

describe("SignInPage (unit, no real APIs)", () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  // Quiet noisy logs from the component during tests (optional)
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    // Default mount behavior: not authenticated, refresh does nothing
    meMock.mockResolvedValue({ authenticated: false });
    refreshMock.mockResolvedValue({ refreshed: false });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

  it("disables Login until both fields are filled; enables after input", async () => {
    renderPage();

    // Wait until the form appears after the initial async session check
    const userInput = await screen.findByLabelText(/username or email/i);
    const passInput = await screen.findByLabelText(/password/i);
    const loginBtn = await screen.findByRole("button", { name: /login/i });

    expect(loginBtn).toBeDisabled();

    fireEvent.change(userInput, { target: { value: "user@example.com" } });
    expect(loginBtn).toBeDisabled(); // still disabled (no password)

    fireEvent.change(passInput, { target: { value: "Secret123!" } });
    expect(loginBtn).not.toBeDisabled();
  });

  it("navigates to /home on successful login", async () => {
    // Mount pass 1: initial session check -> not authenticated, no refresh
    meMock.mockResolvedValueOnce({ authenticated: false });
    refreshMock.mockResolvedValueOnce({ refreshed: false });

    // Login succeeds
    loginUserMock.mockResolvedValueOnce({ success: true });

    renderPage();

    const userInput = await screen.findByLabelText(/username or email/i);
    const passInput = await screen.findByLabelText(/password/i);
    const loginBtn = await screen.findByRole("button", { name: /login/i });

    fireEvent.change(userInput, { target: { value: "user@example.com" } });
    fireEvent.change(passInput, { target: { value: "Secret123!" } });

    // After login, component calls confirmAndGoHome():
    // it will call me() again -> return authenticated = true so it navigates.
    meMock.mockResolvedValueOnce({ authenticated: true });

    fireEvent.click(loginBtn);

    await waitFor(() => {
      expect(loginUserMock).toHaveBeenCalledWith("user@example.com", "Secret123!");
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/home");
    });
  });
});
