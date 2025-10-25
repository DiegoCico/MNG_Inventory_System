// src/components/Profile.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Avatar,
  Box,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

interface ProfileProps {
  open: boolean;
  onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ open, onClose }) => {
  const handleLogout = () => {
    // Add any logout logic here (clear tokens, etc.)
    window.location.href = '/';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          Profile
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
          {/* Avatar */}
          <AccountCircleIcon
            sx={{
              width: 100,
              height: 100,
              mb: 4
            }}
          >
          </AccountCircleIcon>

          {/* Profile Info */}
          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                letterSpacing: 0.5
              }}
            >
              Name
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              Your name will go here
            </Typography>
          </Box>

          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                letterSpacing: 0.5
              }}
            >
              Email
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              your.email@example.com
            </Typography>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                letterSpacing: 0.5
              }}
            >
              Role
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              Student/Faculty
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="error"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Profile;