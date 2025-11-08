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

  const [authUser, setAuthUser] = useState<{
    userId: string;
    name: string;
    email: string;
    authenticated: boolean;
    role?: string;
  } | null>(null);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedRole, setEditedRole] = useState("");

  /* ============================================================
     LOAD USER + IMAGE
  ============================================================ */
  useEffect(() => {
    if (!open) return;
    const loadUser = async () => {
      console.log("[Profile] Loading user data...");
      setLoading(true);
      try {
        const user = await me();
        console.log("[Profile] User fetched:", user);

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
          console.log("[Profile] Fetching profile image for:", safeUser.userId);
          const res = await getProfileImage(safeUser.userId);
          console.log("[Profile] Image response:", res);
          if (res.url) setProfileImage(res.url);
        }
      } catch (err) {
        console.error("[Profile] Failed to load user:", err);
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

  /* ============================================================
     IMAGE UPLOAD
  ============================================================ */
  const handleFileSelect = (file: File) => {
    console.log("[Profile] Selected file:", file?.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!authUser?.userId) {
        console.warn("[Profile] No user ID — cannot upload image.");
        return;
      }

      setPreview(dataUrl);
      setUploading(true);
      try {
        const res = await uploadProfileImage(authUser.userId, dataUrl);
        console.log("[Profile] Upload response:", res);
        if (res.url) setProfileImage(res.url);
      } catch (err) {
        console.error("[Profile] Upload failed:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  /* ============================================================
     SAVE CHANGES
  ============================================================ */
const handleSave = async () => {
  if (!authUser) {
    console.error("[Profile] No authUser loaded!");
    return;
  }

  console.log("[Profile] Saving profile...");
  console.log("→ User ID:", authUser.userId);
  console.log("→ New Name:", editedName);
  console.log("→ New Role:", editedRole);

  try {
    const result = await updateProfile(
      authUser.userId,
      editedName,
      editedRole
    );
    console.log("[Profile] UpdateProfile success:", result);

    const refreshed = (await me()) as MeResponse;
    console.log("[Profile] Refreshed user:", refreshed);

    setAuthUser({
      userId: refreshed.userId,
      name: refreshed.name,
      email: refreshed.email,
      authenticated: refreshed.authenticated,
      role: refreshed.role || "User",
    });
    setEditedName(refreshed.name || "");
    setEditedRole(refreshed.role || "User");

    setEditing(false);
  } catch (err: any) {
    console.error("[Profile] Update failed:", err);
    if (err instanceof Error) console.error("→ Message:", err.message);
  }
};


  /* ============================================================
     LOGOUT
  ============================================================ */
  const handleLogout = async () => {
    console.log("[Profile] Logging out...");
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
        <IconButton onClick={onClose} color="inherit">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* LOADING */}
      {loading ? (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          height={300}
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
            Please authenticate to view your profile
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 3, borderRadius: 2, px: 4 }}
            onClick={() => (window.location.href = "/signin")}
          >
            Sign In
          </Button>
        </Box>
      ) : (
        <>
          <DialogContent dividers sx={{ px: 4, py: 4 }}>
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              mb={4}
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
                        }}
                      >
                        {!profileImage && (
                          <AccountCircleIcon sx={{ fontSize: 80 }} />
                        )}
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
                            p: 0.6,
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
            </Box>

            <Stack spacing={3}>
              <TextField
                label="Name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                fullWidth
                disabled={!editing}
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
              justifyContent: "space-between",
            }}
          >
            <Box>
              {!editing ? (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => setEditing(true)}
                  sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
                >
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSave}
                    sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditedName(authUser?.name || "");
                      setEditedRole(authUser?.role || "User");
                      setEditing(false);
                    }}
                    sx={{ borderRadius: 2, fontWeight: 600, ml: 1 }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </Box>

            <Box>
              <Button onClick={onClose} sx={{ fontWeight: 600 }}>
                Close
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{ fontWeight: 700, borderRadius: 2, px: 3, ml: 1 }}
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
