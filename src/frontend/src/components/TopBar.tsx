import React from "react";
import {
  AppBar,
  Toolbar,
  Stack,
  Typography,
  IconButton,
  Button,
  Avatar,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useTheme, alpha } from "@mui/material/styles";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import SecurityIcon from "@mui/icons-material/Security";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useColorMode } from "../ThemeContext";

interface TopBarProps {
  isLoggedIn: boolean;
  onProfileClick?: () => void;
  profileImage?: string | null;
  onRequestAccess?: () => void; 
}

export default function TopBar({
  isLoggedIn,
  onProfileClick,
  profileImage,
  onRequestAccess,
}: TopBarProps) {
  const theme = useTheme();
  const { mode, toggleTheme } = useColorMode();

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }}>
        {/* Left side: SupplyNet logo */}
        <Stack
          direction="row"
          spacing={1.2}
          alignItems="center"
          sx={{
            flexGrow: 1,
            color: theme.palette.primary.contrastText,
            textDecoration: "none",
          }}
          component={Link}
          to={isLoggedIn ? "/teams" : "/"}
        >
          <MilitaryTechIcon sx={{ color: theme.palette.primary.contrastText }} />
          <Typography variant="h6" fontWeight={800}>
            SupplyNet
          </Typography>
        </Stack>

        {/* Theme toggle */}
        <IconButton
          onClick={toggleTheme}
          sx={{
            color: theme.palette.primary.contrastText,
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
            mr: !isLoggedIn ? 1 : 0, // spacing if buttons exist
          }}
        >
          {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>

        {/* Right side */}
        {isLoggedIn ? (
          <IconButton
            size="large"
            onClick={onProfileClick}
            sx={{
              color: theme.palette.primary.contrastText,
              "&:hover": { bgcolor: theme.palette.primary.dark },
            }}
          >
            {profileImage ? <Avatar src={profileImage} alt="Profile" /> : <AccountCircleIcon fontSize="large" />}
          </IconButton>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              to="/signin"
              variant="contained"
              color="warning"
              startIcon={<SecurityIcon />}
              sx={{ fontWeight: 700 }}
            >
              Sign In
            </Button>
            <Button
              variant="outlined"
              onClick={onRequestAccess}
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.contrastText,
                borderColor: alpha(theme.palette.primary.contrastText, 0.6),
                "&:hover": {
                  borderColor: "#fff",
                  bgcolor: alpha(theme.palette.primary.contrastText, 0.1),
                },
              }}
            >
              Request Access
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}
