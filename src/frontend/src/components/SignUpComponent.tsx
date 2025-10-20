import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Stack,
} from "@mui/material";
import { Visibility, VisibilityOff, CheckCircle, Cancel } from "@mui/icons-material";
import { completeNewPassword } from "../api/auth";

/* -------------------------------------------------------------------------- */
/*                              Sign Up Component                             */
/* -------------------------------------------------------------------------- */
function SignUpComponent({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emailValid = /\S+@\S+\.\S+/.test(email);

  const passwordRequirements = {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const allPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = password !== "" && password === confirmPassword;
  const allValid = emailValid && allPasswordValid && passwordsMatch;

  const renderRequirement = (label: string, met: boolean) => (
    <Box display="flex" alignItems="center" gap={1}>
      {met ? (
        <CheckCircle fontSize="small" color="success" />
      ) : (
        <Cancel fontSize="small" color="error" />
      )}
      <Typography variant="body2" color={met ? "success.main" : "text.secondary"}>
        {label}
      </Typography>
    </Box>
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const session = localStorage.getItem("cognitoSession");
    if (!session) return alert("Missing session");
    try {
      setSubmitting(true);
      const res = await completeNewPassword(session, password, email);
      if (res.success) onComplete();
      else alert(res.error ?? "Failed to complete registration");
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
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
            Complete Your Registration
          </Typography>
          <Typography variant="body1" sx={{ color: "#3A3A3A" }}>
            Set your credentials to finish signing in
          </Typography>
        </Box>

        <TextField
          label="Username"
          fullWidth
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          InputProps={{
            sx: {
              backgroundColor: "#FAFAFA",
              borderRadius: 2,
              color: "#000",
              input: { color: "#000" }, // ensure typed text is black
            },
          }}
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        <TextField
          label="Email"
          type="email"
          fullWidth
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!emailValid && email !== ""}
          helperText={!emailValid && email !== "" ? "Enter a valid email address" : ""}
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
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            sx: {
              backgroundColor: "#FAFAFA",
              borderRadius: 2,
              color: "#000",
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
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        <Box sx={{ ml: 1, mt: -1 }}>
          {renderRequirement("At least 10 characters", passwordRequirements.minLength)}
          {renderRequirement("At least one uppercase letter", passwordRequirements.uppercase)}
          {renderRequirement("At least one lowercase letter", passwordRequirements.lowercase)}
          {renderRequirement("At least one number", passwordRequirements.number)}
        </Box>

        <TextField
          label="Confirm Password"
          type={showConfirmPassword ? "text" : "password"}
          fullWidth
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          InputProps={{
            sx: {
              backgroundColor: "#FAFAFA",
              borderRadius: 2,
              color: "#000",
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
          InputLabelProps={{ sx: { color: "#555" } }}
        />

        <Box sx={{ ml: 1, mt: -1 }}>
          {renderRequirement("Passwords match", passwordsMatch)}
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={!allValid || submitting}
          sx={{
            borderRadius: 2,
            py: 1.3,
            fontWeight: 800,
            fontSize: "1rem",
            bgcolor: "#283996",       
            color: "#FFFFFF",
            ":hover": { bgcolor: "#1D2D77" },
            opacity: allValid ? 1 : 0.8, 
          }}
        >
          {submitting ? "Submitting..." : "Sign Up"}
        </Button>
      </Stack>
    </Box>
  );
}

export default SignUpComponent;
