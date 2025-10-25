// src/pages/HomePage.tsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  LinearProgress,
  useTheme,
  Grid,
  IconButton,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import NavBar from "../components/NavBar";
import Profile from "../components/Profile";

const HomePage: React.FC = () => {
  const theme = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);

  // Mock data
  const progressData = {
    total: 100,
    reviewed: 30,
    toReview: 70,
  };

  const completionPercent = Math.round(
    (progressData.reviewed / progressData.total) * 100
  );

  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(completionPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [completionPercent]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      {/* --- Top Banner --- */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
          px: 3,
          py: 2,
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          MassNatGuard
        </Typography>
        <IconButton
          size="large"
          sx={{
            color: theme.palette.primary.contrastText,
            "&:hover": {
              bgcolor: theme.palette.primary.dark,
            },
          }}
          onClick={() => setProfileOpen(true)}
        >
          <AccountCircleIcon fontSize="large" />
        </IconButton>
      </Box>

      {/* --- Main Content --- */}
      <Container
        maxWidth="sm"
        sx={{
          py: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Header */}
        <Typography
          variant="h5"
          sx={{
            mb: 4,
            fontWeight: 700,
            textAlign: "center",
            mt: 2,
          }}
        >
          Overall Progress
        </Typography>

        {/* Circular Progress */}
        <Box sx={{ position: "relative", display: "inline-flex", mb: 5 }}>
          <CircularProgress
            variant="determinate"
            value={animatedProgress}
            size={150}
            thickness={5}
            sx={{
              color: theme.palette.primary.main,
              backgroundColor: theme.palette.background.paper,
              borderRadius: "50%",
            }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="h3" component="div" color="textPrimary">
              {`${animatedProgress}%`}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Complete
            </Typography>
          </Box>
        </Box>

        {/* Task Breakdown */}
        <Box sx={{ width: "100%", mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Task Breakdown
          </Typography>

          {/* To Review */}
          <Box sx={{ mb: 2 }}>
            <Grid container justifyContent="space-between">
              <Typography variant="body2" color="textSecondary">
                To Review
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {progressData.toReview}/{progressData.total}
              </Typography>
            </Grid>
            <LinearProgress
              variant="determinate"
              value={(progressData.toReview / progressData.total) * 100}
              color="error"
              sx={{
                height: 8,
                borderRadius: 5,
                backgroundColor: theme.palette.divider,
              }}
            />
          </Box>

          {/* Reviewed */}
          <Box>
            <Grid container justifyContent="space-between">
              <Typography variant="body2" color="textSecondary">
                Reviewed
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {progressData.reviewed}/{progressData.total}
              </Typography>
            </Grid>
            <LinearProgress
              variant="determinate"
              value={(progressData.reviewed / progressData.total) * 100}
              color="success"
              sx={{
                height: 8,
                borderRadius: 5,
                backgroundColor: theme.palette.divider,
              }}
            />
          </Box>
        </Box>

        <NavBar />
      </Container>

      {/* Profile Modal */}
      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />
    </Box>
  );
};

export default HomePage;