import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
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
        bgcolor: "#f5f6fa",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 440,
          boxShadow: 3,
          borderRadius: 3,
          p: 3,
          backgroundColor: "white",
        }}
      >
        <CardContent>
          {!isSigningUp ? (
            <>
              <Typography variant="h4" fontWeight="bold" align="center" mb={1}>
                Welcome Back
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                align="center"
                mb={3}
              >
                Please log in to your account
              </Typography>

              <Box
                component="form"
                display="flex"
                flexDirection="column"
                gap={2}
                onSubmit={handleLogin}
              >
                <TextField
                  label="Username or Email"
                  variant="outlined"
                  fullWidth
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  slotProps={{
                    input: {
                      sx: { bgcolor: "#fafafa", borderRadius: 2 },
                    },
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
                  slotProps={{
                    input: {
                      sx: { bgcolor: "#fafafa", borderRadius: 2 },
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={!allFilled}
                  sx={{
                    borderRadius: 2,
                    bgcolor: allFilled ? "#1976d2" : "grey.400",
                    textTransform: "none",
                    fontSize: "1rem",
                    py: 1,
                    "&:hover": {
                      bgcolor: allFilled ? "#1565c0" : "grey.500",
                    },
                  }}
                >
                  Login
                </Button>
              </Box>
            </>
          ) : (
            <SignUpComponent onComplete={() => navigate("/")} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignInPage;
