import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";
import SignUpComponent from "../components/SignUpComponent"

function SignInPage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const allFilled = identifier.trim() !== "" && password.trim() !== "";

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await loginUser(identifier, password);
   
      if (res.challengeName === "NEW_PASSWORD_REQUIRED") {
        setIsSigningUp(true);
        localStorage.setItem("cognitoSession", res.session); 
      } else if (res.success) {
        navigate("/home");
      } else {
        console.log("Login failed:", res.error);
        console.error("Login challenge:", res.challengeName);
        alert(res.error ?? "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
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