import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Stack,
  Alert,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import { Visibility, VisibilityOff, CheckCircle, Cancel, Lock } from "@mui/icons-material";
import { completeNewPassword, me, refresh, loginUser } from "../api/auth";
import EmailOtpCard from "./EmailOtpCard";

type OtpChallengeName = "EMAIL_OTP" | "SMS_MFA" | "SOFTWARE_TOKEN_MFA";

interface CompleteNewPasswordResponse {
  success?: boolean;
  challengeName?: OtpChallengeName | string;
  session?: string;
  message?: string;
}

interface LoginUserResponse {
  success?: boolean;
  challengeName?: OtpChallengeName | string;
  session?: string;
  message?: string;
}

function scorePassword(pw: string): { score: number; label: string } {
  const reqs = [pw.length >= 10, /[A-Z]/.test(pw), /[a-z]/.test(pw), /\d/.test(pw)];
  const met = reqs.filter(Boolean).length;
  const score = [0, 25, 50, 75, 100][met];
  const label = ["Too weak", "Weak", "Okay", "Good", "Strong"][met];
  return { score, label };
}

function Req({ label, met }: { label: string; met: boolean }) {
  return (
    <Box display="flex" alignItems="center" gap={1}>
      {met ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="error" />}
      <Typography variant="body2" color={met ? "success.main" : "text.secondary"}>
        {label}
      </Typography>
    </Box>
  );
}

function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

export default function SignUpComponent({ onComplete }: { onComplete: () => void }) {
  // Email comes from SignIn step; user cannot change it here.
  const presetEmail = useMemo(() => localStorage.getItem("cognitoEmail") || "", []);
  const [email] = useState(presetEmail);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [capsOnPwd, setCapsOnPwd] = useState(false);
  const [capsOnConfirm, setCapsOnConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OTP UI state
  const [otpUI, setOtpUI] = useState<{
    visible: boolean;
    challengeName?: OtpChallengeName;
    session?: string;
    email?: string;
  }>({ visible: false });

  // If already signed in via cookie, finish immediately.
  useEffect(() => {
    (async () => {
      try {
        const m1 = await me();
        if (m1.authenticated) {
          onComplete();
          return;
        }
        const r = await refresh().catch(() => ({ refreshed: false as const }));
        if (r?.refreshed) {
          const m2 = await me();
          if (m2.authenticated) {
            onComplete();
            return;
          }
        }
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [onComplete]);

  // Live validation state
  const emailValid = /\S+@\S+\.\S+/.test(email);
  const reqs = {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  const allPasswordValid = Object.values(reqs).every(Boolean);
  const passwordsMatch = password !== "" && password === confirmPassword;

  const { score, label } = scorePassword(password);

  /** Re-check cookies and finish if a session is present. */
  const confirmCookiesAndFinish = async () => {
    const m1 = await me();
    if (m1.authenticated) {
      onComplete();
      return;
    }
    const r = await refresh().catch(() => ({ refreshed: false as const }));
    if (r?.refreshed) {
      const m2 = await me();
      if (m2.authenticated) {
        onComplete();
        return;
      }
    }
    throw new Error("Session cookie not detected.");
  };

  /** Submit handler — validates on click; button stays visible/enabled. */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (!emailValid || !allPasswordValid || !passwordsMatch) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setError(null);
    const session = localStorage.getItem("cognitoSession");
    if (!session) {
      setError("Missing Cognito session. Please go back and sign in again.");
      return;
    }

    try {
      setSubmitting(true);

      // Finish NEW_PASSWORD_REQUIRED
      const res = (await completeNewPassword(session, password, email)) as CompleteNewPasswordResponse;

      if (res?.success) {
        try {
          await confirmCookiesAndFinish();
          return;
        } catch {
          /* continue to OTP path if needed */
        }
      }

      if (res?.challengeName && res?.session) {
        setOtpUI({
          visible: true,
          challengeName: res.challengeName as OtpChallengeName,
          session: res.session,
          email,
        });
        return;
      }

      setError(res?.message ?? "Could not complete registration. Please try again.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Network error while completing registration."));
    } finally {
      setSubmitting(false);
    }
  };

  /** Resend OTP by re-triggering sign-in with the new password we just set. */
  const handleResendCode = async () => {
    try {
      setSubmitting(true);
      const res = (await loginUser(email, password)) as LoginUserResponse;
      if (res?.session && res?.challengeName) {
        setOtpUI({
          visible: true,
          challengeName: res.challengeName as OtpChallengeName,
          session: res.session,
          email,
        });
      } else {
        setError("Could not resend code. Try again shortly.");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not resend code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) return null;

  // OTP step UI
  if (otpUI.visible && otpUI.session && otpUI.email) {
    return (
      <EmailOtpCard
        session={otpUI.session}
        email={otpUI.email}
        challengeName={otpUI.challengeName}
        helperText={
          otpUI.challengeName === "EMAIL_OTP"
            ? "We sent a verification code to your email."
            : "Enter the verification code from your device."
        }
        onResend={handleResendCode}
        onBack={() => setOtpUI({ visible: false })}
      />
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={3}>
        <Box textAlign="center">
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#1F1F1F", mb: 0.5, letterSpacing: 0.3 }}>
            Complete Your Registration
          </Typography>
          <Typography variant="body1" sx={{ color: "#3A3A3A" }}>
            Set your password to finish signing in
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* EMAIL (locked) */}
        <TextField
          label="Email (locked)"
          type="email"
          fullWidth
          value={email}
          disabled
          InputProps={{
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <Lock fontSize="small" />
              </InputAdornment>
            ),
            sx: { backgroundColor: "#F3F3F3", borderRadius: 2, color: "#000", input: { color: "#000" } },
          }}
          helperText="This email was set by your invite and cannot be changed here."
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        {/* PASSWORD */}
        <TextField
          label="New Password"
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) =>
            setCapsOnPwd(e.getModifierState?.("CapsLock") ?? false)
          }
          error={password !== "" && !allPasswordValid}
          helperText={password === "" ? "" : allPasswordValid ? "" : "Password must meet all requirements"}
          InputProps={{
            sx: { backgroundColor: "#FAFAFA", borderRadius: 2, color: "#000", input: { color: "#000" } },
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={showPassword ? "Hide password" : "Show password"}>
                  <IconButton onClick={() => setShowPassword((p) => !p)} edge="end" aria-label="toggle password visibility">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        {/* Strength meter + caps-lock warning */}
        <Box>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">Password strength: {label}</Typography>
            {capsOnPwd && <Typography variant="caption" color="warning.main">Caps Lock is ON</Typography>}
          </Box>
          <LinearProgress variant="determinate" value={score} />
        </Box>

        {/* Requirements list */}
        <Box sx={{ ml: 1, mt: -1 }}>
          <Req label="At least 10 characters" met={reqs.minLength} />
          <Req label="At least one uppercase letter" met={reqs.uppercase} />
          <Req label="At least one lowercase letter" met={reqs.lowercase} />
          <Req label="At least one number" met={reqs.number} />
        </Box>

        {/* CONFIRM PASSWORD */}
        <TextField
          label="Confirm New Password"
          type={showConfirmPassword ? "text" : "password"}
          fullWidth
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) =>
            setCapsOnConfirm(e.getModifierState?.("CapsLock") ?? false)
          }
          error={confirmPassword !== "" && !passwordsMatch}
          helperText={confirmPassword === "" ? "" : passwordsMatch ? "" : "Passwords do not match"}
          InputProps={{
            sx: { backgroundColor: "#FAFAFA", borderRadius: 2, color: "#000", input: { color: "#000" } },
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={showConfirmPassword ? "Hide password" : "Show password"}>
                  <IconButton onClick={() => setShowConfirmPassword((p) => !p)} edge="end" aria-label="toggle confirm password visibility">
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        {/* Match indicator + caps-lock warning */}
        <Box sx={{ ml: 1, mt: -1 }}>
          <Req label="Passwords match" met={passwordsMatch} />
          {capsOnConfirm && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
              Caps Lock is ON
            </Typography>
          )}
        </Box>

        {/* CTA: always visible/enabled unless actually submitting */}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting}
          sx={{
            borderRadius: 2,
            bgcolor: submitting ? "grey.400" : "#1976d2",
            textTransform: "none",
            fontSize: "1rem",
            py: 1.2,
            "&:hover": { bgcolor: submitting ? "grey.500" : "#1565c0" },
          }}
        >
          {submitting ? "Setting password..." : "Set Password & Continue"}
        </Button>
      </Stack>
    </Box>
  );
}
