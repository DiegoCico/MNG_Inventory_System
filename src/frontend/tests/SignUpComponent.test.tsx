// tests/SignUpComponent.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignUpComponent from "../src/components/SignUpComponent";

// ---------- Types ----------
type CompleteNewPasswordResult = { success: boolean; error?: string };
type MeResult = { authenticated: boolean };
type RefreshResult = { refreshed: boolean };

// ---------- Label helper ----------
// MUI appends an asterisk to required labels (e.g., "Email *").
// This helper matches the base label with optional whitespace + "*".
const req = (name: string) => new RegExp(`^${name}\\s*\\*?$`, "i");

// ---------- Mocks ----------
const completeNewPasswordMock = vi.fn<
  (session: string, newPassword: string, email: string) => Promise<CompleteNewPasswordResult>
>();
const meMock = vi.fn<() => Promise<MeResult>>();
const refreshMock = vi.fn<() => Promise<RefreshResult>>();

vi.mock("../src/api/auth", () => ({
  completeNewPassword: (...args: unknown[]) =>
    completeNewPasswordMock(...(args as Parameters<typeof completeNewPasswordMock>)),
  me: () => meMock(),
  refresh: () => refreshMock(),
}));

// Silence alerts & noisy logs during tests
vi.spyOn(window, "alert").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

describe("SignUpComponent (simplified, stable tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: user not authenticated and refresh does nothing
    meMock.mockResolvedValue({ authenticated: false });
    refreshMock.mockResolvedValue({ refreshed: false });
  });

  const setup = (onComplete = vi.fn()) => render(<SignUpComponent onComplete={onComplete} />);

  const fillStrongPassword = async (value = "StrongPass123") => {
    const pass = await screen.findByLabelText(req("Password"));
    const confirm = await screen.findByLabelText(/confirm password/i);
    fireEvent.change(pass, { target: { value } });
    fireEvent.change(confirm, { target: { value } });
  };

  it("renders form and Sign Up is disabled initially", async () => {
    setup();
    // Wait for the form to appear after the async session check
    const heading = await screen.findByText(/complete your registration/i);
    expect(heading).toBeInTheDocument();

    const username = await screen.findByLabelText(/username/i);
    const email = await screen.findByLabelText(req("Email"));
    const password = await screen.findByLabelText(req("Password"));
    const confirm = await screen.findByLabelText(/confirm password/i);
    const submitBtn = await screen.findByRole("button", { name: /sign up/i });

    expect(username).toBeInTheDocument();
    expect(email).toBeInTheDocument();
    expect(password).toBeInTheDocument();
    expect(confirm).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it("enables Sign Up only when email + strong passwords match", async () => {
    setup();

    const email = await screen.findByLabelText(req("Email"));
    const password = await screen.findByLabelText(req("Password"));
    const confirm = await screen.findByLabelText(/confirm password/i);
    const submitBtn = await screen.findByRole("button", { name: /sign up/i });

    // invalid email + weak password
    fireEvent.change(email, { target: { value: "user@" } });
    fireEvent.change(password, { target: { value: "aaa" } });
    fireEvent.change(confirm, { target: { value: "aaa" } });
    expect(submitBtn).toBeDisabled();

    // valid email but weak password
    fireEvent.change(email, { target: { value: "user@example.com" } });
    expect(submitBtn).toBeDisabled();

    // strong password but mismatch
    fireEvent.change(password, { target: { value: "StrongPass123" } });
    fireEvent.change(confirm, { target: { value: "StrongPass1234" } });
    expect(submitBtn).toBeDisabled();

    // match -> enabled
    fireEvent.change(confirm, { target: { value: "StrongPass123" } });
    expect(submitBtn).toBeEnabled();
  });

  it("submits: calls completeNewPassword(session, password, email) and then onComplete when cookies are confirmed", async () => {
    const onComplete = vi.fn();

    // First render effect: me -> false, refresh -> false (default)
    // After successful password set, component checks cookies:
    // me() again -> return true so it can call onComplete
    meMock.mockResolvedValueOnce({ authenticated: false });   // initial effect (explicit)
    refreshMock.mockResolvedValueOnce({ refreshed: false });  // initial effect (explicit)
    meMock.mockResolvedValueOnce({ authenticated: true });    // confirmCookiesAndFinish

    completeNewPasswordMock.mockResolvedValue({ success: true });
    localStorage.setItem("cognitoSession", "sess-123");

    setup(onComplete);

    const email = await screen.findByLabelText(req("Email"));
    fireEvent.change(email, { target: { value: "user@example.com" } });

    await fillStrongPassword("StrongPass123");

    const username = await screen.findByLabelText(/username/i);
    fireEvent.change(username, { target: { value: "Diego" } });

    const submitBtn = await screen.findByRole("button", { name: /sign up/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(completeNewPasswordMock).toHaveBeenCalledWith(
        "sess-123",
        "StrongPass123",
        "user@example.com"
      );
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("quick sanity: enabled when all requirements met", async () => {
    setup();

    const email = await screen.findByLabelText(req("Email"));
    const password = await screen.findByLabelText(req("Password"));
    const confirm = await screen.findByLabelText(/confirm password/i);
    const username = await screen.findByLabelText(/username/i);
    const submitBtn = await screen.findByRole("button", { name: /sign up/i });

    fireEvent.change(email, { target: { value: "ok@example.com" } });
    fireEvent.change(password, { target: { value: "StrongPass123" } });
    fireEvent.change(confirm, { target: { value: "StrongPass123" } });
    fireEvent.change(username, { target: { value: "Diego" } });

    expect(submitBtn).toBeEnabled();
  });
});
