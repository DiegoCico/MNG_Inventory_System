import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

type Challenge = 'NEW_PASSWORD_REQUIRED' | 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';

type MeRes = { authenticated: boolean };
type RefreshRes = { refreshed: boolean };
type LoginRes = {
  challengeName?: Challenge;
  session?: string;
  success?: boolean;
  error?: string;
};

vi.mock('../src/api/auth', () => {
  const me = (): Promise<MeRes> => Promise.resolve({ authenticated: false });
  const refresh = (): Promise<RefreshRes> => Promise.resolve({ refreshed: false });
  const loginUser = (_identifier: string, _password: string): Promise<LoginRes> =>
    Promise.resolve({});

  return { me, refresh, loginUser };
});

// ---------- Mock children with typed props ----------
interface SignUpComponentProps {
  onComplete: () => void;
}
vi.mock('../src/components/SignUpComponent', () => ({
  __esModule: true,
  default: ({ onComplete }: SignUpComponentProps) => (
    <div data-testid="signup-mock">
      <p>SignUpComponent</p>
      <button onClick={onComplete}>complete-signup</button>
    </div>
  ),
}));

interface EmailOtpCardProps {
  session: string;
  email: string;
  challengeName?: Challenge;
  helperText?: string;
  onResend: () => void;
  onBack: () => void;
}
vi.mock('../src/components/EmailOtpCard', () => ({
  __esModule: true,
  default: (props: EmailOtpCardProps) => (
    <div data-testid="email-otp-mock">
      <p>EmailOtpCard</p>
      <button onClick={props.onResend}>resend</button>
      <button onClick={props.onBack}>back</button>
    </div>
  ),
}));

// ---------- Mock navigate ----------
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import SignInPage from '../src/pages/SignInPage';

describe('SignInPage (UI-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login view after session check', async () => {
    render(<SignInPage />);

    expect(screen.queryByText(/Welcome Back/i)).toBeNull(); // null during checking

    expect(await screen.findByText(/Welcome Back/i)).toBeInTheDocument();
    expect(screen.getByText(/Please log in to your account/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    const loginBtn = screen.getByRole('button', { name: /login/i });
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn).toBeEnabled();
  });

  it('switches to Email OTP view on OTP challenge (UI only)', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'loginUser').mockResolvedValueOnce({
      challengeName: 'EMAIL_OTP',
      session: 'abc',
      success: false,
    } as LoginRes);

    render(<SignInPage />);
    await screen.findByText(/Welcome Back/i);

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByTestId('email-otp-mock')).toBeInTheDocument();
    expect(screen.queryByText(/Welcome Back/i)).toBeNull();
  });

  it('switches to Sign Up on NEW_PASSWORD_REQUIRED (UI only)', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'loginUser').mockResolvedValueOnce({
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'xyz',
      success: false,
    } as LoginRes);

    render(<SignInPage />);
    await screen.findByText(/Welcome Back/i);

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByTestId('signup-mock')).toBeInTheDocument();
    expect(screen.queryByText(/Welcome Back/i)).toBeNull();
  });

  it('can go back from OTP to login view (UI only)', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'loginUser').mockResolvedValueOnce({
      challengeName: 'EMAIL_OTP',
      session: 'abc',
      success: false,
    } as LoginRes);

    render(<SignInPage />);
    await screen.findByText(/Welcome Back/i);

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByTestId('email-otp-mock')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/back/i));

    expect(await screen.findByText(/Welcome Back/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('resend in OTP view stays on OTP (UI only)', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'loginUser')
      .mockResolvedValueOnce({
        challengeName: 'EMAIL_OTP',
        session: 'abc',
        success: false,
      } as LoginRes) // first login -> OTP
      .mockResolvedValueOnce({
        challengeName: 'EMAIL_OTP',
        session: 'def',
        success: false,
      } as LoginRes); // resend -> still OTP

    render(<SignInPage />);
    await screen.findByText(/Welcome Back/i);

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByTestId('email-otp-mock')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/resend/i));

    expect(await screen.findByTestId('email-otp-mock')).toBeInTheDocument();
  });
});
