import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import ReplayIcon from "@mui/icons-material/Replay";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { submitOtp } from "../api/auth";

type OtpChallengeName = "EMAIL_OTP" | "SMS_MFA" | "SOFTWARE_TOKEN_MFA";

interface EmailOtpCardProps {
  session: string;
  email: string;
  challengeName?: OtpChallengeName;
  helperText?: string;
  onResend?: () => Promise<void> | void;
  onBack?: () => void;
}

interface SubmitOtpResponse {
  success?: boolean;
  message?: string;
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

export default function EmailOtpCard({
  session,
  email,
  challengeName = "EMAIL_OTP",
  helperText = "We sent a verification code to your email.",
  onResend,
  onBack,
}: EmailOtpCardProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const title =
    challengeName === "EMAIL_OTP"
      ? "Enter Email Code"
      : challengeName === "SMS_MFA"
      ? "Enter SMS Code"
      : "Enter Authenticator Code";

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter the code.");
      return;
    }

    try {
      setSubmitting(true);
      const res = (await submitOtp(
        challengeName,
        session,
        trimmed,
        email
      )) as SubmitOtpResponse;

      if (res?.success) {
        navigate("/teams", { replace: true });
        return;
      }

      setError(res?.message ?? "Verification failed. Check the code and try again.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid or expired code. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    try {
      setSubmitting(true);
      await onResend();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not resend code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      elevation={3}
      sx={{
        width: "100%",
        maxWidth: 480,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 3,
        bgcolor: "#FFFFFF",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#1F1F1F" }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: "#3A3A3A", mt: 0.5 }}>
              {helperText}
            </Typography>
            <Typography variant="caption" sx={{ color: "#5A5A5A" }}>
              {email}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            component="form"
            onSubmit={handleVerify}
            sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
          >
            <TextField
              label="One-time code"
              variant="outlined"
              fullWidth
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              inputProps={{ inputMode: "numeric", maxLength: 8 }}
              InputProps={{
                sx: {
                  backgroundColor: "#FAFAFA",
                  borderRadius: 2,
                  color: "#000",
                  input: { color: "#000", textAlign: "center", letterSpacing: 2 },
                },
              }}
              InputLabelProps={{ sx: { color: "#555" } }}
            />

            {/* Button always visible/enabled (only disabled while submitting) */}
            <Button
              type="submit"
              variant="contained"
              startIcon={<KeyIcon />}
              fullWidth
              disableElevation
              disabled={submitting}
              sx={{
                borderRadius: 2,
                py: 1.3,
                fontWeight: 800,
                fontSize: "1rem",
                bgcolor: submitting ? "grey.400" : "#283996",
                color: "#FFFFFF",
                ":hover": { bgcolor: submitting ? "grey.500" : "#1D2D77" },
              }}
            >
              {submitting ? "Verifying..." : "Verify code"}
            </Button>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 0.5 }}
              spacing={1}
            >
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                disabled={submitting}
              >
                Back
              </Button>

              <Button
                variant="text"
                startIcon={<ReplayIcon />}
                onClick={handleResend}
                disabled={submitting || !onResend}
              >
                Resend code
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
