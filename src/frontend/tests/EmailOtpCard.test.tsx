import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import EmailOtpCard from '../src/components/EmailOtpCard';

type OtpChallengeName = 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';
type SubmitOtpResponse = { success?: boolean; message?: string };

// ---- Mock navigate so routing doesn't actually change location ----
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../src/api/auth', () => {
  const submitOtp = (
    _challenge: OtpChallengeName,
    _session: string,
    _code: string,
    _email: string,
  ): Promise<SubmitOtpResponse> => Promise.resolve({ success: false });
  return { submitOtp };
});

describe('EmailOtpCard (UI-only)', () => {
  const baseProps = {
    session: 'sess-123',
    email: 'user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default EMAIL_OTP title, helper text, and email', () => {
    render(<EmailOtpCard {...baseProps} />);
    expect(screen.getByText(/Enter Email Code/i)).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification code to your email\./i)).toBeInTheDocument();
    expect(screen.getByText(/user@example\.com/i)).toBeInTheDocument();

    // Input and buttons exist
    expect(screen.getByLabelText(/One-time code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend code/i })).toBeDisabled(); // disabled when no onResend
  });

  it('shows SMS and Authenticator titles for other challengeName values', () => {
    const { rerender } = render(<EmailOtpCard {...baseProps} challengeName="SMS_MFA" />);
    expect(screen.getByText(/Enter SMS Code/i)).toBeInTheDocument();

    rerender(<EmailOtpCard {...baseProps} challengeName="SOFTWARE_TOKEN_MFA" />);
    expect(screen.getByText(/Enter Authenticator Code/i)).toBeInTheDocument();
  });

  it('navigates to /workspace when submitOtp resolves with success', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'submitOtp').mockResolvedValueOnce({ success: true });

    render(<EmailOtpCard {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/One-time code/i), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/teams', { replace: true }));
  });

  it('shows server message on unsuccessful verification (still UI-only)', async () => {
    const authMod = (await import('../src/api/auth')) as typeof import('../src/api/auth');
    vi.spyOn(authMod, 'submitOtp').mockResolvedValueOnce({
      success: false,
      message: 'Wrong code.',
    });

    render(<EmailOtpCard {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/One-time code/i), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    expect(await screen.findByText(/Wrong code\./i)).toBeInTheDocument();
  });

  it('Back button calls onBack', () => {
    const onBack = vi.fn();
    render(<EmailOtpCard {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Resend button enabled when onResend provided and stays on screen', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined);
    render(<EmailOtpCard {...baseProps} onResend={onResend} />);

    const resend = screen.getByRole('button', { name: /resend code/i });
    expect(resend).toBeEnabled();

    fireEvent.click(resend);
    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));

    // Still on OTP view
    expect(screen.getByText(/Enter Email Code/i)).toBeInTheDocument();
  });
});
