import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import SignUpPage from "../src/pages/SignUpPage";

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders all input fields and sign-up button", () => {
    renderWithRouter(<SignUpPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  test("sign-up button is disabled initially", () => {
    renderWithRouter(<SignUpPage />);
    const button = screen.getByRole("button", { name: /sign up/i });
    expect(button).toBeDisabled();
  });

  test("email validation updates live", () => {
    renderWithRouter(<SignUpPage />);
    const emailInput = screen.getByLabelText(/email/i);

    // Invalid email first
    fireEvent.change(emailInput, { target: { value: "test@gmail.com" } });
    const emailRequirement = screen.getByText(/ends with @military\.gov/i);
    expect(emailRequirement).toHaveStyle("color: rgba(0, 0, 0, 0.6)");

    // Valid email
    fireEvent.change(emailInput, { target: { value: "user@military.gov" } });
    expect(emailRequirement).toHaveStyle("color: rgb(46, 125, 50)");
  });

  test("password requirements update as user types", () => {
    renderWithRouter(<SignUpPage />);
    const passwordInput = screen.getByLabelText(/^password$/i);

    // Not valid yet
    fireEvent.change(passwordInput, { target: { value: "Short1" } });
    expect(screen.getByText(/at least 10 characters/i)).toHaveStyle(
      "color: rgba(0, 0, 0, 0.6)"
    );

    // Fully valid
    fireEvent.change(passwordInput, { target: { value: "ValidPass123" } });
    expect(screen.getByText(/at least 10 characters/i)).toHaveStyle(
      "color: rgb(46, 125, 50)"
    );
    expect(screen.getByText(/at least one uppercase letter/i)).toHaveStyle(
      "color: rgb(46, 125, 50)"
    );
    expect(screen.getByText(/at least one lowercase letter/i)).toHaveStyle(
      "color: rgb(46, 125, 50)"
    );
    expect(screen.getByText(/at least one number/i)).toHaveStyle(
      "color: rgb(46, 125, 50)"
    );
  });

  test("passwords must match for Sign Up to enable", () => {
    renderWithRouter(<SignUpPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const button = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: "user@military.gov" } });
    fireEvent.change(passwordInput, { target: { value: "ValidPass123" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "Different123" } });
    expect(button).toBeDisabled();

    fireEvent.change(confirmPasswordInput, { target: { value: "ValidPass123" } });
    expect(button).not.toBeDisabled();
  });

  test("navigates to home page when valid form is submitted", async () => {
    const mockNavigate = vi.fn();

    vi.mock("react-router-dom", async () => {
      const actual = (await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      )) as typeof import("react-router-dom");
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });    

    // ✅ Dynamically import after mocking
    const { default: SignUpPageMocked } = await import("../src/pages/SignUpPage");

    renderWithRouter(<SignUpPageMocked />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "john" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "ValidPass123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "ValidPass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("has a working link to Sign In page", () => {
    renderWithRouter(<SignUpPage />);
    const loginLink = screen.getByRole("link", { name: /login/i });
    expect(loginLink).toHaveAttribute("href", "/signin");
  });
});
