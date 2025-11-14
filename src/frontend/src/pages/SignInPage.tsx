import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
  Stack,
  IconButton,
  InputAdornment,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";

import { loginUser, me, refresh } from '../api/auth';
import SignUpComponent from '../components/SignUpComponent';
import EmailOtpCard from '../components/EmailOtpCard';

export default function SignInPage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 👁️ toggle state

  const [otpUI, setOtpUI] = useState<{
    visible: boolean;
    challengeName?: 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';
    session?: string;
    email?: string;
  }>({ visible: false });

  const navigate = useNavigate();

  const confirmAndEnterApp = async () => {
    const m1 = await me();
    if (m1.authenticated) {
      navigate('/teams', { replace: true });
      return;
    }
    const r = await refresh().catch(() => ({ refreshed: false as const }));
    if (r?.refreshed) {
      const m2 = await me();
      if (m2.authenticated) {
        navigate("/teams", { replace: true });
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const m1 = await me();
        if (m1.authenticated) {
          navigate('/teams', { replace: true });
          return;
        }
        const r = await refresh().catch(() => ({ refreshed: false as const }));
        if (r?.refreshed) {
          const m2 = await me();
          if (m2.authenticated) {
            navigate("/teams", { replace: true });
          }
        }
      } catch {
        /* ignore */
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [navigate]);

  const doLogin = async () => {
    setErrorMsg("");
    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);

      if (res?.challengeName === 'NEW_PASSWORD_REQUIRED') {
        setIsSigningUp(true);
        localStorage.setItem('cognitoSession', res.session);
        localStorage.setItem('cognitoEmail', identifier);
        return;
      }

      if (
        res?.challengeName === 'EMAIL_OTP' ||
        res?.challengeName === 'SMS_MFA' ||
        res?.challengeName === 'SOFTWARE_TOKEN_MFA'
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

      setErrorMsg("Username/Email is incorrect or Password is incorrect");
    } catch {
      setErrorMsg("Username/Email is incorrect or Password is incorrect");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await doLogin();
  };

  const handleResendCode = async () => {
    try {
      setSubmitting(true);
      const res = await loginUser(identifier, password);
      if (res?.session && res?.challengeName) {
        setOtpUI({
          visible: true,
          challengeName: res.challengeName,
          session: res.session,
          email: identifier,
        });
      } else {
        setErrorMsg("Could not resend code. Try again later.");
      }
    } catch {
      setErrorMsg("Could not resend code. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const onLoginView = !isSigningUp && !otpUI.visible;
  if (checkingSession) return null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
        backgroundColor: '#F4F4F1',
      }}
    >
      <Card
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 3,
          bgcolor: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CardContent sx={{ p: 4, pb: 2, flex: "1 1 auto" }}>
          {isSigningUp ? (
            <SignUpComponent onComplete={confirmAndEnterApp} />
          ) : otpUI.visible && otpUI.session && otpUI.email ? (
            <EmailOtpCard
              session={otpUI.session}
              email={otpUI.email}
              challengeName={otpUI.challengeName}
              helperText={
                otpUI.challengeName === 'EMAIL_OTP'
                  ? 'We sent a code to your email. Enter it below to continue.'
                  : 'Enter the code from your device to continue.'
              }
              onResend={handleResendCode}
              onBack={() => setOtpUI({ visible: false })}
            />
          ) : (
            <Stack spacing={3}>
              <Box textAlign="center">
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    color: '#1F1F1F',
                    mb: 0.5,
                    letterSpacing: 0.3,
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography variant="body1" sx={{ color: '#3A3A3A' }}>
                  Please log in to your account
                </Typography>
              </Box>

              <Box
                component="form"
                onSubmit={handleLogin}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
              >
                <TextField
                  label="Username or Email"
                  variant="outlined"
                  fullWidth
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMsg("");
                  }}
                  error={!!errorMsg}
                  helperText={
                    errorMsg &&
                    "Username/Email is incorrect or Password is incorrect"
                  }
                />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  variant="outlined"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg("");
                  }}
                  error={!!errorMsg}
                  helperText={
                    errorMsg &&
                    "Username/Email is incorrect or Password is incorrect"
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <button type="submit" style={{ display: "none" }} />
              </Box>
            </Stack>
          )}
        </CardContent>

        {onLoginView && (
          <>
            <Divider />
            <Box sx={{ p: 2.5, bgcolor: "#FFFFFF" }}>
              <Button
                onClick={doLogin}
                variant="contained"
                startIcon={<SecurityIcon />}
                fullWidth
                disableElevation
                disabled={submitting}
                sx={{
                  borderRadius: 2,
                  py: 1.2,
                  fontWeight: 800,
                  fontSize: '1rem',
                  bgcolor: '#283996',
                  color: '#FFFFFF',
                  ':hover': { bgcolor: '#1D2D77' },
                }}
              >
                {submitting ? 'Logging in...' : 'Login'}
              </Button>
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
}
