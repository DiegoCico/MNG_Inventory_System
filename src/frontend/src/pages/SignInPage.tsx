import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { loginUser, me, refresh } from "../api/auth"; 
import SignUpComponent from "../components/SignUpComponent";

function SignInPage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  const allFilled = identifier.trim() !== "" && password.trim() !== "";

  // Utility: log cookies easily
  const logCookies = () => {
    const cookies = document.cookie;
    console.log("Current cookies in browser:", cookies || "(none)");
    if (!cookies.includes("auth_")) {
      console.warn(" No auth_* cookies found — might be blocked by HTTPS/CORS settings.");
    }
  };

  // Check cookie session on mount; if present, hop to /home
  useEffect(() => {
    (async () => {
      console.log("Checking session on mount...");
      logCookies();
      try {
        const m1 = await me(); // GET /trpc/me?input=null (with credentials)
        console.log("/me response:", m1);
        if (m1.authenticated) {
          console.log("Existing session found — redirecting to /home");
          navigate("/home", { replace: true });
          return;
        }
        // try one silent refresh if not authed
        console.log("No active session, trying silent refresh...");
        const r = await refresh().catch(() => ({ refreshed: false }));
        console.log("refresh() result:", r);
        if (r?.refreshed) {
          const m2 = await me();
          console.log("/me after refresh:", m2);
          if (m2.authenticated) {
            console.log("Refreshed session valid — redirecting to /home");
            navigate("/home", { replace: true });
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

  const confirmAndGoHome = async () => {
    console.log("Confirming cookies after login...");
    logCookies();
    // Confirm cookies landed by checking /me; fallback to /refresh once
    const m1 = await me();
    console.log("/me after login:", m1);
    if (m1.authenticated) {
      console.log("Cookie session detected — navigating to /home");
      navigate("/home");
      return;
    }
    console.log("No valid /me session found, attempting refresh...");
    const r = await refresh().catch(() => ({ refreshed: false }));
    console.log("refresh() result:", r);
    if (r?.refreshed) {
      const m2 = await me();
      console.log("/me after refresh:", m2);
      if (m2.authenticated) {
        console.log("Session restored after refresh — navigating to /home");
        navigate("/home");
        return;
      }
    }
    // If still not authed, let the user know; cookies likely blocked by browser/CORS/HTTPS
    console.warn("Signed in, but no cookies stored!");
    alert("Signed in, but session cookie not detected. Check HTTPS/CORS/cookie settings.");
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Attempting login for:", identifier);
    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);
      console.log("loginUser() response:", res);
      logCookies();

      if (res.challengeName === "NEW_PASSWORD_REQUIRED") {
        console.log("Challenge: NEW_PASSWORD_REQUIRED — switching to sign-up flow");
        setIsSigningUp(true);
        localStorage.setItem("cognitoSession", res.session);
        // Stay on this page; your <SignUpComponent> will complete it
        return;
      }

      if (res.success) {
        console.log("Login success — verifying cookie-based session...");
        await confirmAndGoHome();
        return;
      }

      console.log("Login failed:", res.error);
      console.error("Login challenge:", res.challengeName);
      alert(res.error ?? "Invalid credentials");
    } catch (err) {
      console.error("Network or backend error:", err);
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return null;
  }

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
          maxWidth: 440,
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 3,
          bgcolor: "#FFFFFF",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {!isSigningUp ? (
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
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                }}
              >
                <TextField
                  label="Username or Email"
                  variant="outlined"
                  fullWidth
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  InputProps={{
                    sx: {
                      backgroundColor: "#FAFAFA",
                      borderRadius: 2,
                      color: "#000", 
                      input: { color: "#000" },
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: "#555" },
                  }}
                />

                <TextField
                  label="Password"
                  type="password"
                  variant="outlined"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    sx: {
                      backgroundColor: "#FAFAFA",
                      borderRadius: 2,
                      color: "#000", // ✅ black text
                      input: { color: "#000" },
                    },
                  }}
                  InputLabelProps={{
                    sx: { color: "#555" },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SecurityIcon />}
                  fullWidth
                  disableElevation
                  sx={{
                    borderRadius: 2,
                    py: 1.3,
                    fontWeight: 800,
                    fontSize: "1rem",
                    bgcolor: "#283996", // navy blue
                    color: "#FFFFFF",
                    ":hover": { bgcolor: "#1D2D77" },
                  }}
                >
                  {submitting ? "Logging in..." : "Login"}
                </Button>
              </Box>
            </Stack>
          ) : (
            <SignUpComponent onComplete={() => navigate("/")} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignInPage;
