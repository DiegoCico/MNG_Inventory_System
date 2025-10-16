// tests/SignUpComponent.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SignUpComponent from "../src/components/SignUpComponent";

// ---------- Types ----------
type CompleteNewPasswordResult = { success: boolean; error?: string };

// ---------- Label helper ----------
// MUI appends an asterisk to required labels (e.g., "Email *").
// This helper matches the base label with optional whitespace + "*".
const req = (name: string) => new RegExp(`^${name}\\s*\\*?$`, "i");

// ---------- Mocks ----------
const completeNewPasswordMock = vi.fn<
  (session: string, newPassword: string, email: string) => Promise<CompleteNewPasswordResult>
>();

vi.mock("../src/api/auth", () => ({
  completeNewPassword: (...args: unknown[]) =>
    completeNewPasswordMock(...(args as Parameters<typeof completeNewPasswordMock>)),
}));

// Spy on alerts
const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

describe("SignUpComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const setup = (onComplete = vi.fn()) => render(<SignUpComponent onComplete={onComplete} />);

  const fillStrongPassword = (value = "StrongPass123") => {
    // ≥10 chars, includes upper/lower/number
    fireEvent.change(screen.getByLabelText(req("Password")), {
      target: { value },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value },
    });
  };

  // Helper to get the endAdornment IconButton inside a MUI TextField
  const getVisibilityToggleFor = (inputEl: HTMLElement) => {
    const wrapper = inputEl.closest(".MuiFormControl-root") as HTMLElement | null;
    expect(wrapper).not.toBeNull(); // ensure it exists for TS and test clarity
    // There should be exactly one IconButton inside the adornment
    return within(wrapper as HTMLElement).getByRole("button");
  };

  it("renders initial form and Sign Up is disabled", () => {
    setup();
    expect(screen.getByText(/complete your registration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(req("Email"))).toBeInTheDocument();
    expect(screen.getByLabelText(req("Password"))).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /sign up/i });
    expect(submitBtn).toBeDisabled();
  });

  it("shows email error for invalid email and clears it for a valid email", () => {
    setup();

    const email = screen.getByLabelText(req("Email"));
    fireEvent.change(email, { target: { value: "user@" } });
    expect(email).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(email, { target: { value: "user" } });
    expect(email).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(email, { target: { value: "user@example.com" } });
    expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  it("enforces password requirements (length, upper, lower, number) and matching", () => {
    setup();

    fireEvent.change(screen.getByLabelText(req("Password")), {
      target: { value: "aA1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "aA1" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();

    fillStrongPassword("VeryStrong123");
    fireEvent.change(screen.getByLabelText(req("Email")), {
      target: { value: "ok@example.com" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });

  it("toggles password visibility for both password fields", () => {
    setup();

    const passwordField = screen.getByLabelText(req("Password")) as HTMLInputElement;
    const confirmField = screen.getByLabelText(/confirm password/i) as HTMLInputElement;

    const passwordToggle = getVisibilityToggleFor(passwordField);
    const confirmToggle = getVisibilityToggleFor(confirmField);

    // Default types
    expect(passwordField.type).toBe("password");
    expect(confirmField.type).toBe("password");

    // Toggle to text
    fireEvent.click(passwordToggle);
    expect(passwordField.type).toBe("text");

    fireEvent.click(confirmToggle);
    expect(confirmField.type).toBe("text");

    // Toggle back
    fireEvent.click(passwordToggle);
    expect(passwordField.type).toBe("password");

    fireEvent.click(confirmToggle);
    expect(confirmField.type).toBe("password");
  });

  it("calls completeNewPassword with (session, password, email) and calls onComplete on success", async () => {
    const onComplete = vi.fn();
    completeNewPasswordMock.mockResolvedValue({ success: true });

    setup(onComplete);

    localStorage.setItem("cognitoSession", "sess-123");
    fireEvent.change(screen.getByLabelText(req("Email")), {
      target: { value: "user@example.com" },
    });
    fillStrongPassword("StrongPass123");
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "Diego" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(completeNewPasswordMock).toHaveBeenCalledWith(
        "sess-123",
        "StrongPass123",
        "user@example.com"
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps Sign Up disabled until ALL rules are met", () => {
    setup();

    // Invalid email + weak password
    fireEvent.change(screen.getByLabelText(req("Email")), {
      target: { value: "user@" },
    });
    fireEvent.change(screen.getByLabelText(req("Password")), {
      target: { value: "aaaaaaa" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "aaaaaaa" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();

    // Fix email but keep weak password -> still disabled
    fireEvent.change(screen.getByLabelText(req("Email")), {
      target: { value: "user@example.com" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();

    // Strong password but mismatch -> still disabled
    fireEvent.change(screen.getByLabelText(req("Password")), {
      target: { value: "StrongPass123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "StrongPass1234" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeDisabled();

    // Match -> enabled
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "StrongPass123" },
    });
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });
});
