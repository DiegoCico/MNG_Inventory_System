import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SignUpComponent from "../src/components/SignUpComponent";

type OtpChallengeName = 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';
type MeRes = { authenticated: boolean };
type RefreshRes = { refreshed: boolean };
type CompleteNewPasswordResponse = {
  success?: boolean;
  challengeName?: OtpChallengeName | string;
  session?: string;
  message?: string;
};

interface EmailOtpCardProps {
  session: string;
  email: string;
  challengeName?: OtpChallengeName;
  helperText?: string;
  onResend?: () => Promise<void> | void;
  onBack?: () => void;
}

vi.mock("../src/components/EmailOtpCard", () => ({
  __esModule: true,
  default: (_: EmailOtpCardProps) => <div data-testid="otp-card-stub">OTP</div>,
}));

vi.mock("../src/api/auth", () => {
  const me = (): Promise<MeRes> => Promise.resolve({ authenticated: false });
  const refresh = (): Promise<RefreshRes> => Promise.resolve({ refreshed: false });
  const completeNewPassword = (
    _session: string,
    _pw: string,
    _email: string,
  ): Promise<CompleteNewPasswordResponse> => Promise.resolve({});
  const loginUser = (_id: string, _pw: string) => Promise.resolve({});
  return { me, refresh, completeNewPassword, loginUser };
});

describe('SignUpComponent (UI-only)', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("cognitoEmail", "user@example.com");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows top-level alert if submitting with invalid fields", async () => {
    render(<SignUpComponent onComplete={onComplete} />);
    await screen.findByText(/Complete Your Registration/i);
    fireEvent.click(
      screen.getByRole("button", { name: /Set Password & Continue/i })
    );
    expect(
      await screen.findByText(/Please fix the highlighted fields/i)
    ).toBeInTheDocument();
  });
});
