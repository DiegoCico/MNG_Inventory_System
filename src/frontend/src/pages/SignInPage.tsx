import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import { useNavigate } from "react-router-dom";

import { loginUser, me, refresh } from "../api/auth";
import SignUpComponent from "../components/SignUpComponent";
import EmailOtpCard from "../components/EmailOtpCard";

export default function SignInPage() {
  /* ------------------------------- UI State -------------------------------- */
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // OTP challenge state
  const [otpUI, setOtpUI] = useState<{
    visible: boolean;
    challengeName?: "EMAIL_OTP" | "SMS_MFA" | "SOFTWARE_TOKEN_MFA";
    session?: string;
    email?: string;
  }>({ visible: false });

  const navigate = useNavigate();

  /* ----------------------------- Debug helpers ----------------------------- */
  const logCookies = () => {
    const cookies = document.cookie;
    console.log("Current cookies in browser:", cookies || "(none)");
    if (!cookies.includes("auth_")) {
      console.warn(" No auth_* cookies found — might be blocked by HTTPS/CORS settings.");
    }
  };

  const confirmAndEnterApp = async () => {
    console.log("Confirming cookies after auth...");
    logCookies();
    const m1 = await me();
    console.log("/me after auth:", m1);
    if (m1.authenticated) {
      navigate("/teams", { replace: true });
      return;
    }
    const r = await refresh().catch(() => ({ refreshed: false as const }));
    console.log("refresh() result:", r);
    if (r?.refreshed) {
      const m2 = await me();
      console.log("/me after refresh:", m2);
      if (m2.authenticated) {
        navigate("/teams", { replace: true });
        return;
      }
    }
    console.warn("Signed in, but no cookies stored!");
    alert("Signed in, but session cookie not detected. Check HTTPS/CORS/cookie settings.");
  };

  /* ------------------------ Session check on first load -------------------- */
  useEffect(() => {
    (async () => {
      console.log("Checking session on mount...");
      logCookies();
      try {
        const m1 = await me();
        console.log("/me response:", m1);
        if (m1.authenticated) {
          navigate("/teams", { replace: true });
          return;
        }
        const r = await refresh().catch(() => ({ refreshed: false as const }));
        console.log("refresh() result:", r);
        if (r?.refreshed) {
          const m2 = await me();
          console.log("/me after refresh:", m2);
          if (m2.authenticated) {
            navigate("/teams", { replace: true });
            return;
          }
        }
      } catch (err) {
        console.warn("Session check error (likely first visit):", err);
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [navigate]);

  /* --------------------------- Core login flow ----------------------------- */
  const doLogin = async () => {
    console.log("Attempting login for:", identifier);
    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);
      console.log("loginUser() response:", res);
      logCookies();

      if (res?.challengeName === "NEW_PASSWORD_REQUIRED") {
        setIsSigningUp(true);
        localStorage.setItem("cognitoSession", res.session);
        localStorage.setItem("cognitoEmail", identifier);
        return;
      }

      if (
        res?.challengeName === "EMAIL_OTP" ||
        res?.challengeName === "SMS_MFA" ||
        res?.challengeName === "SOFTWARE_TOKEN_MFA"
      ) {
        setOtpUI({
          visible: true,
          challengeName: res.challengeName,
          session: res.session,
          email: identifier,
        });
        setIsSigningUp(false);
        return;
      }

      if (res?.success) {
        await confirmAndEnterApp();
        return;
      }

      console.error("Login failed:", res);
      alert(res?.error ?? "Invalid credentials");
    } catch (err) {
      console.error("Network or backend error:", err);
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------ Enter key on form submit ----------------------- */
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await doLogin();
  };

  /* ------------------------- OTP resend (re-sign in) ----------------------- */
  const handleResendCode = async () => {
    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);
      console.log("Resent code, signIn response:", res);
      if (res?.session && res?.challengeName) {
        setOtpUI({
          visible: true,
          challengeName: res.challengeName,
          session: res.session,
          email: identifier,
        });
        alert("A new code has been sent.");
      } else {
        alert("Could not resend code. Try again in a moment.");
      }
    } catch (e) {
      console.error("Resend error:", e);
      alert("Could not resend code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- View flags ------------------------------ */
  const onLoginView = !isSigningUp && !otpUI.visible;

  if (checkingSession) return null;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
        backgroundColor: "#F4F4F1",
      }}
    >
      <Card
        elevation={3}
        sx={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 3,
          bgcolor: "#FFFFFF",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Main content */}
        <CardContent sx={{ p: 4, pb: 2, flex: "1 1 auto" }}>
          {isSigningUp ? (
            <SignUpComponent
              onComplete={async () => {
                await confirmAndEnterApp();
              }}
            />
          ) : otpUI.visible && otpUI.session && otpUI.email ? (
            <EmailOtpCard
              session={otpUI.session}
              email={otpUI.email}
              challengeName={otpUI.challengeName}
              helperText={
                otpUI.challengeName === "EMAIL_OTP"
                  ? "We sent a code to your email. Enter it below to continue."
                  : "Enter the code from your device to continue."
              }
              onResend={handleResendCode}
              onBack={() => setOtpUI({ visible: false })}
            />
          ) : (
            // Login form
            <Stack spacing={3}>
              <Box textAlign="center">
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    color: "#1F1F1F",
                    mb: 0.5,
                    letterSpacing: 0.3,
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography variant="body1" sx={{ color: "#3A3A3A" }}>
                  Please log in to your account
                </Typography>
              </Box>

              <Box
                component="form"
                onSubmit={handleLogin}
                sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
              >
                <TextField
                  label="Username or Email"
                  variant="outlined"
                  fullWidth
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  InputProps={{
                    sx: {
                      backgroundColor: "#FAFAFA",
                      borderRadius: 2,
                      color: "#000",
                      input: { color: "#000" },
                    },
                  }}
                  InputLabelProps={{ sx: { color: "#555" } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  InputProps={{
                    sx: {
                      backgroundColor: "#FAFAFA",
                      borderRadius: 2,
                      color: "#000",
                      input: { color: "#000" },
                    },
                  }}
                  InputLabelProps={{ sx: { color: "#555" } }}
                />

                {/* Hidden submit so Enter triggers login */}
                <button type="submit" style={{ display: "none" }} />
              </Box>
            </Stack>
          )}
        </CardContent>

        {/* Footer: ONLY renders on the login view */}
        {onLoginView && (
          <>
            <Divider />
            <Box
              sx={{
                p: 2.5,
                position: "sticky",
                bottom: 0,
                bgcolor: "#FFFFFF",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
              }}
            >
              <Button
                onClick={doLogin}
                variant="contained"
                startIcon={<SecurityIcon />}
                fullWidth
                disableElevation
                disabled={submitting} // only disable while submitting
                sx={{
                  borderRadius: 2,
                  py: 1.2,
                  fontWeight: 800,
                  fontSize: "1rem",
                  bgcolor: "#283996",
                  color: "#FFFFFF",
                  ":hover": { bgcolor: "#1D2D77" },
                }}
              >
                {submitting ? "Logging in..." : "Login"}
              </Button>
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
}
