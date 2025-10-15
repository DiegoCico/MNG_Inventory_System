import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignInPage from "../src/pages/SignInPage"; // adjust path if needed

// mock react-router-dom navigation
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

window.alert = vi.fn();


describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in form initially", () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeDisabled();
  });

  it("enables login button when both fields are filled", () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "user@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Temp1234" },
    });

    expect(screen.getByRole("button", { name: /login/i })).toBeEnabled();
  });

  it("shows alert for invalid credentials", async () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );
  
    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "wrong@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "badpass" },
    });
  
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
  
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Invalid credentials (simulated)");
    });
  });
  

  it("switches to SignUpComponent when using temporary password", async () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "temp@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Temp1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/complete your registration/i)
      ).toBeInTheDocument();
    });
  });

  it("navigates to home if user logs in with existing credentials", async () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "existing@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "ExistingPass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("validates and completes SignUp flow", async () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    // step 1: simulate temporary login
    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "temp@military.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Temp1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/complete your registration/i)
      ).toBeInTheDocument();
    });

    // step 2: fill sign-up form
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "NewUser" },
    });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: "user@military.gov" },
    });
    const [passwordInput] = screen.getAllByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "ValidPass123" } 
    });    
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(confirmPasswordInput, { target: { value: "ValidPass123" } 
    });
    

    const signupButton = screen.getByRole("button", { name: /sign up/i });
    await waitFor(() => expect(signupButton).toBeEnabled());

    fireEvent.click(signupButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });
});
