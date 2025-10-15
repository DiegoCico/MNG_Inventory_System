// import { useState } from "react";
// import {
//   Box,
//   Button,
//   Card,
//   CardContent,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useNavigate } from "react-router-dom";

// function SignInPage() {
//   const [identifier, setIdentifier] = useState(""); // username or email
//   const [password, setPassword] = useState("");
//   const navigate = useNavigate();

//   const allFilled = identifier.trim() !== "" && password.trim() !== "";

//   const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();

//     // In your final implementation:
//     // - Use AWS Cognito's signIn() method here
//     // - Cognito will handle the actual validation
//     // - Optionally save cookies / IP info after successful login
//     navigate("/");
//   };

//   return (
//     <Box
//       sx={{
//         minHeight: "100vh",
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "center",
//         bgcolor: "#f5f6fa",
//         p: 2,
//       }}
//     >
//       <Card
//         sx={{
//           width: "100%",
//           maxWidth: 420,
//           boxShadow: 3,
//           borderRadius: 3,
//           p: 2,
//           backgroundColor: "white",
//         }}
//       >
//         <CardContent>
//           {/* Title */}
//           <Typography variant="h4" fontWeight="bold" align="center" mb={1}>
//             Welcome Back
//           </Typography>
//           <Typography
//             variant="body1"
//             color="text.secondary"
//             align="center"
//             mb={3}
//           >
//             Please log in to your account
//           </Typography>

//           {/* Form */}
//           <Box
//             component="form"
//             display="flex"
//             flexDirection="column"
//             gap={2}
//             onSubmit={handleLogin}
//           >
//             {/* Username or Email */}
//             <TextField
//               label="Username or Email"
//               variant="outlined"
//               fullWidth
//               required
//               value={identifier}
//               onChange={(e) => setIdentifier(e.target.value)}
//               slotProps={{
//                 input: {
//                   sx: { bgcolor: "#fafafa", borderRadius: 2 },
//                 },
//               }}
//             />

//             {/* Password */}
//             <TextField
//               label="Password"
//               type="password"
//               variant="outlined"
//               fullWidth
//               required
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               slotProps={{
//                 input: {
//                   sx: { bgcolor: "#fafafa", borderRadius: 2 },
//                 },
//               }}
//             />

//             {/* Login button */}
//             <Button
//               type="submit"
//               variant="contained"
//               fullWidth
//               disabled={!allFilled}
//               sx={{
//                 borderRadius: 2,
//                 bgcolor: allFilled ? "#1976d2" : "grey.400",
//                 textTransform: "none",
//                 fontSize: "1rem",
//                 py: 1,
//                 "&:hover": {
//                   bgcolor: allFilled ? "#1565c0" : "grey.500",
//                 },
//               }}
//             >
//               Login
//             </Button>
//           </Box>
//         </CardContent>
//       </Card>
//     </Box>
//   );
// }

// export default SignInPage;

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Visibility, VisibilityOff, CheckCircle, Cancel } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

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

  const emailValid = email.endsWith("@military.gov");
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (allValid) onComplete();
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
        slotProps={{ input: { sx: { bgcolor: "#fafafa", borderRadius: 2 } } }}
      />
      <Box sx={{ ml: 1, mb: 1 }}>
        {renderRequirement("Ends with @military.gov", email === "" ? false : emailValid)}
      </Box>

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

/* -------------------------------------------------------------------------- */
/*                               Auth Page Main                               */
/* -------------------------------------------------------------------------- */
function SignInPage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const allFilled = identifier.trim() !== "" && password.trim() !== "";

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // === Simulated Logic ===
    // In real AWS Cognito integration:
    // Cognito.signIn(identifier, password)
    //   .then((user) => checkChallengeName for "NEW_PASSWORD_REQUIRED")

    const isTemporaryPassword = password === "Temp1234"; // for demo purposes
    const isExistingUser = password === "ExistingPass123";

    if (isTemporaryPassword) {
      setIsSigningUp(true); // show embedded sign-up form
    } else if (isExistingUser) {
      navigate("/"); // successful login → home
    } else {
      alert("Invalid credentials (simulated)");
    }
  };

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