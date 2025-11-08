/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import { motion } from "framer-motion";
import { me, logout } from "../api/auth";
import {
  getProfileImage,
  uploadProfileImage,
  updateProfile,
} from "../api/profile";

type MeResponse = {
  userId: string;
  email: string;
  name: string;
  authenticated: boolean;
  role?: string;
};

const Profile: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [authUser, setAuthUser] = useState<MeResponse | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedRole, setEditedRole] = useState("");

  useEffect(() => {
    if (!open) return;
    const loadUser = async () => {
      setLoading(true);
      try {
        const user = await me();
        const safeUser = user as any;

        setAuthUser({
          userId: safeUser.userId,
          name: safeUser.name,
          email: safeUser.email,
          authenticated: safeUser.authenticated,
          role: safeUser.role || "User",
        });

        setEditedName(safeUser.name || "");
        setEditedRole(safeUser.role || "User");

        if (safeUser.authenticated) {
          const res = await getProfileImage(safeUser.userId);
          if (res.url) setProfileImage(res.url);
        }
      } catch {
        setAuthUser({
          userId: "",
          name: "",
          email: "",
          authenticated: false,
          role: "User",
        });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [open]);

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
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!authUser) return;
    try {
      await updateProfile(authUser.userId, editedName, editedRole);
      const refreshed = (await me()) as MeResponse;
      setAuthUser(refreshed);
      setEditedName(refreshed.name || "");
      setEditedRole(refreshed.role || "User");
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
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
          bgcolor:
            theme.palette.mode === "dark"
              ? "#1E1E1E"
              : theme.palette.background.default,
          color: theme.palette.text.primary,
          boxShadow: `0 8px 30px ${
            theme.palette.mode === "dark" ? "#00000099" : "#00000022"
          }`,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor:
            theme.palette.mode === "dark"
              ? "#2B2B2B"
              : theme.palette.grey[100],
          px: 3,
          py: 2,
        }}
      >
        <Typography variant="h6" fontWeight={800}>
          Profile
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {loading ? (
        <Box
          height={300}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <CircularProgress />
        </Box>
      ) : !authUser?.authenticated ? (
        <Box
          p={5}
          display="flex"
          flexDirection="column"
          alignItems="center"
          textAlign="center"
        >
          <AccountCircleIcon
            sx={{ fontSize: 100, mb: 2, color: "text.secondary" }}
          />
          <Typography variant="h6" fontWeight={600}>
            Please sign in to view your profile
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 3, borderRadius: 3, px: 4, fontWeight: 700 }}
            onClick={() => (window.location.href = "/signin")}
          >
            Sign In
          </Button>
        </Box>
      ) : (
        <>
          <DialogContent sx={{ px: 4, py: 4 }}>
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              mb={4}
              position="relative"
            >
              <input
                type="file"
                accept="image/*"
                id="profile-upload"
                style={{ display: "none" }}
                onChange={(e) =>
                  e.target.files?.[0] && handleFileSelect(e.target.files[0])
                }
              />
              <label htmlFor="profile-upload">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  {uploading ? (
                    <CircularProgress size={96} />
                  ) : (
                    <>
                      <Avatar
                        src={preview || profileImage || undefined}
                        sx={{
                          width: 110,
                          height: 110,
                          mb: 1,
                          border: `3px solid ${theme.palette.primary.main}`,
                        }}
                      >
                        {!profileImage && (
                          <AccountCircleIcon sx={{ fontSize: 80 }} />
                        )}
                      </Avatar>
                      <Tooltip title="Change picture" arrow>
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 6,
                            right: 6,
                            bgcolor: theme.palette.primary.main,
                            color: "#fff",
                            borderRadius: "50%",
                            p: 0.6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
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

            <Stack spacing={3}>
              <TextField
                label="Name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                fullWidth
                disabled={!editing}
                variant="outlined"
              />
              <TextField
                label="Email"
                value={authUser.email}
                fullWidth
                disabled
              />
              <TextField
                label="Role"
                value={editedRole}
                onChange={(e) => setEditedRole(e.target.value)}
                fullWidth
                disabled={!editing}
              />
            </Stack>
          </DialogContent>

          <DialogActions
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              px: 3,
              py: 2,
              bgcolor:
                theme.palette.mode === "dark"
                  ? "#2A2A2A"
                  : theme.palette.grey[100],
              justifyContent: "space-between",
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              {!editing ? (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => setEditing(true)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    px: 3,
                  }}
                >
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSave}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      px: 3,
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      setEditedName(authUser.name);
                      setEditedRole(authUser.role || "User");
                      setEditing(false);
                    }}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 600,
                      px: 3,
                      borderWidth: 2,
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "#fbc02d33"
                          : theme.palette.warning.light,
                      color:
                        theme.palette.mode === "dark"
                          ? "#fffde7"
                          : theme.palette.warning.contrastText,
                      "&:hover": {
                        borderColor: theme.palette.warning.main,
                        bgcolor:
                          theme.palette.mode === "dark"
                            ? "#fbc02d55"
                            : theme.palette.warning.main,
                      },
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </Box>

            <Box display="flex" alignItems="center" gap={1.5}>
              <Button
                onClick={onClose}
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "#383838"
                        : theme.palette.grey[200],
                  },
                }}
              >
                Close
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
              >
                Logout
              </Button>
            </Box>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default Profile;
