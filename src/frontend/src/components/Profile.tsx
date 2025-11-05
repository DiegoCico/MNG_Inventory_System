// src/components/Profile.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Button,
  useTheme,
  Divider,
  Avatar,
  Paper,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

interface ProfileProps {
  open: boolean;
  onClose: () => void;
  profileImage: string | null;
  onProfileImageChange: (file: File) => void;
  name: string;
  email: string;
  team: string;
  permissions: string;
}

const Profile: React.FC<ProfileProps> = ({
  open,
  onClose,
  profileImage,
  onProfileImageChange,
  name,
  email,
  team,
  permissions,
}) => {
  const theme = useTheme();

  const handleLogout = () => {
    window.location.href = "/";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          p: 1,
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" fontWeight={800}>
          Profile
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Main Content */}
      <DialogContent dividers sx={{ px: 4, py: 3 }}>
        {/* Profile Picture Section */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <input
            data-testid="file-input"
            accept="image/*"
            type="file"
            id="profile-image-upload"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onProfileImageChange(e.target.files[0]);
              }
            }}
          />
          <label htmlFor="profile-image-upload">
            {profileImage ? (
              <Avatar
                src={profileImage}
                alt="Profile"
                sx={{
                  width: 100,
                  height: 100,
                  cursor: "pointer",
                  mb: 1,
                }}
              />
            ) : (
              <AccountCircleIcon
                sx={{
                  width: 100,
                  height: 100,
                  color: theme.palette.text.secondary,
                  cursor: "pointer",
                  mb: 1,
                }}
              />
            )}
          </label>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Click to change profile picture
          </Typography>
        </Box>

        {/* Info Cards */}
        <Stack spacing={2.5}>
          {[
            { label: "Name", value: name },
            { label: "Email", value: email },
            { label: "Team", value: team },
            { label: "Permissions", value: permissions },
          ].map((item, i) => (
            <Paper
              key={i}
              variant="outlined"
              sx={{
                borderRadius: 2,
                p: 2,
                bgcolor: theme.palette.background.default,
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                {item.label}
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </DialogContent>

      {/* Footer Actions */}
      <DialogActions
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          px: 3,
          py: 2,
          justifyContent: "flex-end",
        }}
      >
        <Button
          variant="contained"
          color="error"
          onClick={handleLogout}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Profile;
