/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
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
  Avatar,
  Stack,
  Fade,
  Tooltip,
  CircularProgress,
  TextField,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';

import { motion } from 'framer-motion';

import { me, logout } from '../api/auth';
import { getProfileImage, uploadProfileImage, updateProfile } from '../api/profile';

type MeResponse = {
  userId: string;
  name: string;
  username: string;
  role: string;
  authenticated: boolean;
};

const Profile: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [authUser, setAuthUser] = useState<MeResponse | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [editedName, setEditedName] = useState('');
  const [editedUsername, setEditedUsername] = useState('');

  // LOAD PROFILE
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      try {
        const user = await me();

        const mapped: MeResponse = {
          userId: user.userId,
          name: user.name,
          username: user.username,
          role: user.role ?? 'User',
          authenticated: user.authenticated,
        };

        setAuthUser(mapped);
        setEditedName(mapped.name);
        setEditedUsername(mapped.username);

        if (mapped.authenticated) {
          const img = await getProfileImage(mapped.userId);
          if (img.url) setProfileImage(img.url);
        }
      } catch {
        setAuthUser({
          userId: '',
          name: '',
          username: '',
          role: 'User',
          authenticated: false,
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open]);

  // IMAGE UPLOAD
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!authUser?.userId) return;

      setPreview(dataUrl);
      setUploading(true);

      try {
        const res = await uploadProfileImage(authUser.userId, dataUrl);
        if (res.url) setProfileImage(res.url);
      } catch {
        /* ignore */
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // SAVE PROFILE
  const handleSave = async () => {
    if (!authUser) return;

    try {
      await updateProfile(authUser.userId, editedName, editedUsername);
      const refreshed = await me();

      const mapped: MeResponse = {
        userId: refreshed.userId,
        name: refreshed.name,
        username: refreshed.username,
        role: refreshed.role ?? 'User',
        authenticated: refreshed.authenticated,
      };

      setAuthUser(mapped);
      setEditedName(mapped.name);
      setEditedUsername(mapped.username);
      setEditing(false);
    } catch {
      /* ignore */
    }
  };

  // LOGOUT
  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 5,
        },
      }}
    >
      {/* HEADER */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.default,
        }}
      >
        <Typography variant="h6" fontWeight={800}>
          Profile
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* LOADING */}
      {loading ? (
        <Box p={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      ) : !authUser?.authenticated ? (
        <Box p={4} textAlign="center">
          <AccountCircleIcon sx={{ fontSize: 100, color: theme.palette.text.secondary }} />
          <Typography sx={{ mt: 2 }}>Please sign in</Typography>
        </Box>
      ) : (
        <>
          <DialogContent sx={{ px: 4, py: 4 }}>
            {/* AVATAR */}
            <Box textAlign="center" mb={4} position="relative">
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />

              <label htmlFor="profile-upload">
                <motion.div whileHover={{ scale: 1.05 }} style={{ display: 'inline-block' }}>
                  {uploading ? (
                    <CircularProgress size={96} />
                  ) : (
                    <>
                      <Avatar
                        src={preview || profileImage || undefined}
                        sx={{
                          width: 110,
                          height: 110,
                          border: `3px solid ${theme.palette.primary.main}`,
                        }}
                      >
                        {!profileImage && <AccountCircleIcon sx={{ fontSize: 80 }} />}
                      </Avatar>

                      <Tooltip title="Change picture">
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 6,
                            right: 'calc(50% - 70px)',
                            bgcolor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            borderRadius: '50%',
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </Box>
                      </Tooltip>
                    </>
                  )}
                </motion.div>
              </label>
            </Box>

            {/* FIELDS */}
            <Stack spacing={3}>
              <TextField
                label="Name"
                value={editedName}
                disabled={!editing}
                onChange={(e) => setEditedName(e.target.value)}
                fullWidth
              />

              <TextField
                label="Username"
                value={editedUsername}
                disabled={!editing}
                onChange={(e) => setEditedUsername(e.target.value)}
                fullWidth
              />

              <TextField label="Role" value={authUser.role} disabled fullWidth />
            </Stack>
          </DialogContent>

          {/* FOOTER */}
          <DialogActions sx={{ px: 4, py: 2 }}>
            {!editing ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  sx={{
                    ml: 'auto',
                    bgcolor: '#2F7A32',
                    color: '#fff',
                    '&:hover': { bgcolor: '#27682A' },
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => {
                    setEditedName(authUser.name);
                    setEditedUsername(authUser.username);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}

            <Box flexGrow={1} />

            <Button
              variant="contained"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default Profile;
