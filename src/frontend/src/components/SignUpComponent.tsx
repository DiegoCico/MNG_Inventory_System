import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
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
    const session = localStorage.getItem("cognitoSession");
    if (!session) return alert("Missing session");
    try {
      const res = await completeNewPassword(session, password, email);
      if (res.success) onComplete();
      else alert(res.error ?? "Failed to complete registration");
    } catch {
      alert("Network error");
    }
  };

  return (
    <Box
      component="form"
      display="flex"
      flexDirection="column"
      gap={2}
      onSubmit={handleSubmit}
    >
      <Typography variant="h5" align="center" fontWeight="bold">
        Complete Your Registration
      </Typography>

      <TextField
        label="Username"
        fullWidth
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        slotProps={{ input: { sx: { bgcolor: "#fafafa", borderRadius: 2 } } }}
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
        slotProps={{ input: { sx: { bgcolor: "#fafafa", borderRadius: 2 } } }}
      />

      <TextField
        label="Password"
        type={showPassword ? "text" : "password"}
        fullWidth
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        slotProps={{
          input: {
            sx: { bgcolor: "#fafafa", borderRadius: 2 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((p) => !p)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Box sx={{ ml: 1, mb: 1 }}>
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
        slotProps={{
          input: {
            sx: { bgcolor: "#fafafa", borderRadius: 2 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Box sx={{ ml: 1, mb: 1 }}>
        {renderRequirement("Passwords match", passwordsMatch)}
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={!allValid}
        sx={{
          borderRadius: 2,
          bgcolor: allValid ? "#1976d2" : "grey.400",
          textTransform: "none",
          fontSize: "1rem",
          py: 1,
          "&:hover": {
            bgcolor: allValid ? "#1565c0" : "grey.500",
          },
        }}
      >
        Sign Up
      </Button>
    </Box>
  );
}

export default SignUpComponent;
