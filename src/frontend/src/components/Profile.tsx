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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import { motion } from "framer-motion";
import { me, logout } from "../api/auth"; 
import { getProfileImage, uploadProfileImage } from "../api/profile";

const Profile: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authUser, setAuthUser] = useState<{
    userId: string;
    name: string;
    email: string;
    authenticated: boolean;
  } | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  /* ============================================================
     AUTH + IMAGE LOADING
  ============================================================ */
  useEffect(() => {
    if (!open) return;
    const loadUser = async () => {
      setLoading(true);
      try {
        const user = await me();
        setAuthUser(user);

        if (user.authenticated) {
          const res = await getProfileImage(user.userId);
          if (res.url) setProfileImage(res.url);
        }
      } catch (err) {
        console.error("Profile load failed:", err);
        setAuthUser({ userId: "", name: "", email: "", authenticated: false });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [open]);

  /* ============================================================
     HANDLE FILE UPLOAD
  ============================================================ */
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      if (!authUser?.userId) return;

      setUploading(true);
      try {
        const res = await uploadProfileImage(authUser.userId, dataUrl);
        if (res.url) setProfileImage(res.url);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: `0 8px 32px ${
            theme.palette.mode === "dark" ? "#00000080" : "#00000020"
          }`,
        },
      }}
      TransitionComponent={Fade}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.palette.divider}`,
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

      {/* Loading State */}
      {loading ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      ) : !authUser?.authenticated ? (
        <Box
          sx={{
            p: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <AccountCircleIcon sx={{ fontSize: 100, mb: 2, color: "text.secondary" }} />
          <Typography variant="h6" fontWeight={600}>
            Please authenticate to view your profile
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You need to sign in to access your account information.
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 3, textTransform: "none", borderRadius: 2 }}
            onClick={() => (window.location.href = "/signin")}
          >
            Sign In
          </Button>
        </Box>
      ) : (
        <>
          {/* Main Content */}
          <DialogContent dividers sx={{ px: 4, py: 4 }}>
            {/* Profile Picture */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
              <input
                type="file"
                accept="image/*"
                id="profile-upload"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
              <label htmlFor="profile-upload">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ position: "relative", cursor: "pointer" }}
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
                          bgcolor: theme.palette.background.default,
                        }}
                      >
                        {!profileImage && <AccountCircleIcon sx={{ fontSize: 80 }} />}
                      </Avatar>
                      <Tooltip title="Change profile picture" arrow>
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            bgcolor: theme.palette.primary.main,
                            color: "#fff",
                            borderRadius: "50%",
                            p: 0.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </Box>
                      </Tooltip>
                    </>
                  )}
                </motion.div>
              </label>
              <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                {preview
                  ? ""
                  : "Click to change profile picture"}
              </Typography>
            </Box>

            {/* Info Section */}
            <Stack spacing={2.5}>
              {[
                { label: "Name", value: authUser.name },
                { label: "Email", value: authUser.email },
                { label: "Team", value: "Your Team" },
                { label: "Permissions", value: "User" },
              ].map((info, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                      "&:hover": {
                        bgcolor:
                          theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.07)"
                            : "rgba(0,0,0,0.05)",
                      },
                      transition: "background-color 0.3s ease",
                    }}
                  >
                    <Typography
                      variant="overline"
                      sx={{ color: "text.secondary", fontWeight: 600 }}
                    >
                      {info.label}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {info.value}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Stack>
          </DialogContent>

          {/* Footer */}
          <DialogActions
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              px: 3,
              py: 2,
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <Button
              onClick={onClose}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2, px: 3 }}
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
