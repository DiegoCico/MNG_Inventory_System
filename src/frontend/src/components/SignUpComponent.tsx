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
    <Box display="flex" alignItems="center" gap={0.7}>
      {met ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="disabled" />}
      <Typography
        variant="body2"
        color={met ? "success.main" : "text.secondary"}
        sx={{ fontSize: "0.8rem" }}
      >
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

  const [otpUI, setOtpUI] = useState<{
    visible: boolean;
    challengeName?: OtpChallengeName;
    session?: string;
    email?: string;
  }>({ visible: false });

  useEffect(() => {
    (async () => {
      try {
        const m1 = await me();
        if (m1.authenticated) return onComplete();
        const r = await refresh().catch(() => ({ refreshed: false as const }));
        if (r?.refreshed) {
          const m2 = await me();
          if (m2.authenticated) return onComplete();
        }
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [onComplete]);

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

  const confirmCookiesAndFinish = async () => {
    const m1 = await me();
    if (m1.authenticated) return onComplete();
    const r = await refresh().catch(() => ({ refreshed: false as const }));
    if (r?.refreshed) {
      const m2 = await me();
      if (m2.authenticated) return onComplete();
    }
    throw new Error("Session cookie not detected.");
  };

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
      const res = (await completeNewPassword(session, password, email)) as CompleteNewPasswordResponse;

      if (res?.success) {
        try {
          await confirmCookiesAndFinish();
          return;
        } catch {
          // fallback to OTP flow below if session cookie not found
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

  if (checkingSession) return null;

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
        onResend={() => {}}
        onBack={() => setOtpUI({ visible: false })}
      />
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={3}>
        <Box textAlign="center">
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#1F1F1F", mb: 0.5 }}>
            Complete Your Registration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Set your password to finish signing in
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* EMAIL */}
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
            sx: { backgroundColor: "#F3F3F3", borderRadius: 2, input: { color: "#000" } },
          }}
          helperText="This email was set by your invite and cannot be changed."
        />

        {/* PASSWORD FIELDS */}
        <Stack spacing={2}>
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsOnPwd(e.getModifierState?.("CapsLock") ?? false)}
            InputProps={{
              sx: {
                backgroundColor: "#FAFAFA",
                borderRadius: 2,
                input: { color: "#000" },
              },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((p) => !p)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Confirm Password"
            type={showConfirmPassword ? "text" : "password"}
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyUp={(e) => setCapsOnConfirm(e.getModifierState?.("CapsLock") ?? false)}
            InputProps={{
              sx: {
                backgroundColor: "#FAFAFA",
                borderRadius: 2,
                input: { color: "#000" },
              },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword((p) => !p)} edge="end">
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            error={confirmPassword !== "" && !passwordsMatch}
            helperText={confirmPassword && !passwordsMatch ? "Passwords do not match" : ""}
          />
        </Stack>

        {/* Strength + Requirements BELOW BOTH FIELDS */}
        <Box mt={1}>
          <LinearProgress
            variant="determinate"
            value={score}
            sx={{
              height: 8,
              borderRadius: 4,
              "& .MuiLinearProgress-bar": {
                backgroundColor:
                  score < 40 ? "#d32f2f" : score < 70 ? "#f57c00" : score < 100 ? "#fbc02d" : "#2e7d32",
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Strength: {label}
          </Typography>

          <Box mt={1}>
            <Req label="At least 10 characters" met={reqs.minLength} />
            <Req label="At least one uppercase letter" met={reqs.uppercase} />
            <Req label="At least one lowercase letter" met={reqs.lowercase} />
            <Req label="At least one number" met={reqs.number} />
            <Req label="Passwords match" met={passwordsMatch} />
          </Box>
        </Box>

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
