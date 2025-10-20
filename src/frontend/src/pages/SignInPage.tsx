import { useState } from "react";
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
import SecurityIcon from "@mui/icons-material/Security";
import { loginUser } from "../api/auth";
import SignUpComponent from "../components/SignUpComponent";

function SignInPage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);

      if (res?.challengeName === "NEW_PASSWORD_REQUIRED") {
        setIsSigningUp(true);
        if (res?.session) localStorage.setItem("cognitoSession", res.session);
      } else if (res?.success) {
        navigate("/home");
      } else {
        console.log("Login failed:", res?.error);
        console.error("Login challenge:", res?.challengeName);
        alert(res?.error ?? "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

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
