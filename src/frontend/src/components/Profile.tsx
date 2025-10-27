// src/components/Profile.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface ProfileProps {
  open: boolean;
  onClose: () => void;
  profileImage: string | null;
  onProfileImageChange: (file: File) => void;
  team: string;
  permissions: string;
}

const Profile: React.FC<ProfileProps> = ({
  open,
  onClose,
  profileImage,
  onProfileImageChange,
  team,
  permissions,
}) => {
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
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" component="span">
          Profile
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
          }}
        >
          {/* Profile Image */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <input
              data-testid="file-input"
              accept="image/*"
              type="file"
              style={{ display: 'none' }}
              id="profile-image-upload"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onProfileImageChange(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="profile-image-upload">
              {profileImage ? (
                <Box
                  component="img"
                  src={profileImage}
                  alt="Profile"
                  sx={{ width: 100, height: 100, borderRadius: '50%', cursor: 'pointer' }}
                />
              ) : (
                <AccountCircleIcon sx={{ width: 100, height: 100, cursor: 'pointer' }} />
              )}
            </label>
          </Box>

          {/* Profile Info Sections */}
          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
              Name
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              Your name will go here
            </Typography>
          </Box>

          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
              Email
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              your.email@example.com
            </Typography>
          </Box>

          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
              Role
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              Student / Faculty
            </Typography>
          </Box>

          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
              Team
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {team}
            </Typography>
          </Box>

          <Box sx={{ width: '100%', mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 500, letterSpacing: 0.5 }}>
              Permissions
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {permissions}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
        <Button variant="contained" color="error" onClick={handleLogout}>
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Profile;
