/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Box,
  Button,
  Container,
  Divider,
  Stack,
  Typography,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Grid,
  Snackbar,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useEffect, useState } from "react";
import TeamIcon from "../components/TeamsComponent";
import {
  getTeamspace,
  createTeamspace,
  addUserTeamspace,
  removeUserTeamspace,
  deleteTeamspace,
} from "../api/teamspace";
import { me, inviteUser } from "../api/auth";
import TopBar from "../components/TopBar";
import Profile from "../components/Profile";

export interface Team {
  teamId: string;
  GSI_NAME: string;
  description?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

export default function TeamsPage() {
  const theme = useTheme();

  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);

  const [inviteMode, setInviteMode] = useState<"teamspace" | "platform">(
    "teamspace"
  );

  // Dialog visibility
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Form state for team create
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDesc, setWorkspaceDesc] = useState("");

  // Form state for invite to teamspace (username)
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState("");
  const [memberUsername, setMemberUsername] = useState("");

  // Form state for remove member (username)
  const [removeWorkspaceId, setRemoveWorkspaceId] = useState("");
  const [removeWorkspaceName, setRemoveWorkspaceName] = useState("");
  const [removeMemberUsername, setRemoveMemberUsername] = useState("");

  // Form state for delete teamspace
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState("");
  const [deleteWorkspaceName, setDeleteWorkspaceName] = useState("");

  // Form state for platform invite (email)
  const [inviteEmail, setInviteEmail] = useState("");

  // Username error state for invite
  const [usernameError, setUsernameError] = useState(false);
  const [usernameErrorText, setUsernameErrorText] = useState("");

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "success",
  });

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) {
      throw new Error("User not authenticated or ID missing");
    }
    return user.userId;
  }

  async function refreshTeams(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const userId = await getUserId();
      const data = await getTeamspace(userId);
      setTeams(data?.teams ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load teams";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkUserProfile() {
      try {
        const user = await me();
        if (!user?.name || user.name.trim() === "" || user.name === "User") {
          setProfileOpen(true);
          setShowNameDialog(true);
        } else {
          await refreshTeams();
        }
      } catch (err) {
        console.error("Error checking user profile:", err);
        await refreshTeams();
      }
    }

    void checkUserProfile();
  }, []);

  function openRemoveFor(id: string, name: string): void {
    setRemoveWorkspaceId(id);
    setRemoveWorkspaceName(name);
    setRemoveMemberUsername("");
    setOpenRemove(true);
  }

  function openDeleteFor(id: string, name: string): void {
    setDeleteWorkspaceId(id);
    setDeleteWorkspaceName(name);
    setOpenDelete(true);
  }

  async function handleCreate(): Promise<void> {
    try {
      setLoading(true);
      const userId = await getUserId();
      const result = await createTeamspace(
        workspaceName,
        workspaceDesc,
        userId
      );

      if (!result?.success) {
        setSnackbar({
          open: true,
          message: result.error || "Failed to create team.",
          severity: "error",
        });
        return;
      }

      setSnackbar({
        open: true,
        message: "Teamspace created successfully!",
        severity: "success",
      });
      setOpenCreate(false);
      setWorkspaceName('');
      setWorkspaceDesc('');
      await refreshTeams();
    } catch (err) {
      console.error("❌ handleCreate error:", err);
      setSnackbar({
        open: true,
        message: "Error creating team.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  // Add member to teamspace by USERNAME
  async function handleInvite(): Promise<void> {
    try {
      setUsernameError(false);
      setUsernameErrorText("");

      if (!inviteWorkspaceId) {
        setSnackbar({
          open: true,
          message: "Please select a teamspace.",
          severity: "error",
        });
        return;
      }

      const cleanUsername = memberUsername.trim();
      if (!cleanUsername) {
        setUsernameError(true);
        setUsernameErrorText("Please enter a username.");
        return;
      }

      const userId = await getUserId();
      const result = await addUserTeamspace(
        userId,
        cleanUsername,
        inviteWorkspaceId
      );

      if (!result?.success) {
        if (result?.error?.toLowerCase().includes("not found")) {
          setUsernameError(true);
          setUsernameErrorText("Username not found.");
        }
        setSnackbar({
          open: true,
          message: result?.error || "Failed to add member.",
          severity: "error",
        });
        return;
      }

      setSnackbar({
        open: true,
        message: `User "${cleanUsername}" added to teamspace.`,
        severity: "success",
      });

      setOpenInvite(false);
      setInviteWorkspaceId("");
      setMemberUsername("");
      await refreshTeams();
    } catch (err) {
      console.error("❌ handleInvite error:", err);
      setSnackbar({
        open: true,
        message: "Unexpected error adding member.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  // Remove member from teamspace by USERNAME
  async function handleRemove(): Promise<void> {
    try {
      setLoading(true);

      const cleanUsername = removeMemberUsername.trim();
      if (!cleanUsername) {
        setSnackbar({
          open: true,
          message: "Please enter a member username.",
          severity: "error",
        });
        return;
      }

      if (!removeWorkspaceId) {
        setSnackbar({
          open: true,
          message: "Workspace ID missing.",
          severity: "error",
        });
        return;
      }

      const userId = await getUserId();
      const result = await removeUserTeamspace(
        userId,
        cleanUsername,
        removeWorkspaceId
      );

      if (!result?.success) {
        setSnackbar({
          open: true,
          message: result?.error || "Failed to remove member.",
          severity: "error",
        });
        return;
      }

      setSnackbar({
        open: true,
        message: "Member removed successfully.",
        severity: "success",
      });

      setOpenRemove(false);
      setRemoveWorkspaceId("");
      setRemoveWorkspaceName("");
      setRemoveMemberUsername("");
      await refreshTeams();
    } catch (err) {
      console.error("❌ handleRemove error:", err);
      setSnackbar({
        open: true,
        message: "Error removing member.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      setLoading(true);
      const userId = await getUserId();
      const result = await deleteTeamspace(deleteWorkspaceId, userId);

      if (!result?.success) {
        setSnackbar({
          open: true,
          message: result?.error || "Failed to delete team.",
          severity: "error",
        });
        return;
      }

      setSnackbar({
        open: true,
        message: "Teamspace deleted successfully.",
        severity: "success",
      });

      setOpenDelete(false);
      setDeleteWorkspaceId('');
      setDeleteWorkspaceName('');
      await refreshTeams();
    } catch (err) {
      console.error("❌ handleDelete error:", err);
      setSnackbar({
        open: true,
        message: "Error deleting team.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  // Invite to platform by EMAIL (this stays email-based)
  async function handlePlatformInvite() {
    try {
      const email = inviteEmail.trim();
      if (!email) {
        setSnackbar({
          open: true,
          message: "Please enter a valid email.",
          severity: "error",
        });
        return;
      }

      await inviteUser(email);

      setSnackbar({
        open: true,
        message: `Invitation sent to ${email}`,
        severity: "success",
      });

      setInviteEmail("");
      setOpenInvite(false);
    } catch (err) {
      console.error("❌ Invite failed:", err);
      setSnackbar({
        open: true,
        message: "Failed to send invite.",
        severity: "error",
      });
    }
  }

  const filteredTeams = teams.filter((t) =>
    t.GSI_NAME.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!openInvite) {
      setInviteWorkspaceId("");
      setMemberUsername("");
      setUsernameError(false);
      setUsernameErrorText("");
      setInviteEmail("");
    }
  }, [openInvite]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} onProfileClick={() => setProfileOpen(true)} />
      <Profile
        open={profileOpen}
        onClose={async () => {
          setProfileOpen(false);
          const user = await me();
          if (!user?.name || user.name.trim() === "" || user.name === "User") {
            setShowNameDialog(true);
          } else {
            setShowNameDialog(false);
            refreshTeams();
          }
        }}
      />

      <Container
        maxWidth="lg"
        sx={{ py: { xs: 6, md: 8 } }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={2}
          mb={2.5}
        >
          <Typography variant="h4" sx={{ fontWeight: 900, color: theme.palette.text.primary }}>
            Teamspaces
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setOpenCreate(true)}
              startIcon={<AddIcon />}
              sx={{ fontWeight: 900, textTransform: 'none' }}
            >
              Create Team
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setOpenInvite(true)}
              startIcon={<GroupAddIcon />}
              sx={{ fontWeight: 900, textTransform: 'none' }}
            >
              Invite Member
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          sx={{
            mb: 3,
            bgcolor: theme.palette.background.paper,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <TextField
            label="Search Teams"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {loading && (
          <Box textAlign="center" mt={6}>
            <CircularProgress />
            <Typography sx={{ mt: 2, color: theme.palette.text.secondary }}>
              Loading your teams...
            </Typography>
          </Box>
        )}

        {!loading && error && (
          <Box textAlign="center" mt={6}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {!loading && !error && filteredTeams.length > 0 && (
          <Grid
            container
            spacing={{ xs: 2, sm: 2.5, md: 3 }}
            justifyContent="flex-start"
            sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}
          >
            {filteredTeams.map((team) => (
              <Grid
                key={team.teamId}
                size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}
                sx={{ display: "flex", justifyContent: "center" }}
              >
                <Box sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      display: "flex",
                      alignItems: "stretch",
                      justifyContent: "center",
                    }}
                  >
                    <Box sx={{ width: "100%", height: "100%" }}>
                      <TeamIcon
                        id={team.teamId}
                        name={team.GSI_NAME}
                        description={team.description}
                        onInvite={() => setOpenInvite(true)}
                        onRemove={() =>
                          openRemoveFor(team.teamId, team.GSI_NAME)
                        }
                        onDelete={() =>
                          openDeleteFor(team.teamId, team.GSI_NAME)
                        }
                      />
                    </Box>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && !error && filteredTeams.length === 0 && (
          <Box textAlign="center" mt={6}>
            <Typography>No teams found</Typography>
          </Box>
        )}
      </Container>

      {/* CREATE TEAMSPACE DIALOG */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Create New Teamspace</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Teamspace Name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={workspaceDesc}
            onChange={(e) => setWorkspaceDesc(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* INVITE DIALOG */}
      <Dialog
        open={openInvite}
        onClose={() => setOpenInvite(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={inviteMode}
              onChange={(_, v) => setInviteMode(v)}
              textColor="inherit"
              indicatorColor="warning"
              centered
            >
              <Tab
                label="Add to Teamspace"
                value="teamspace"
                sx={{ fontWeight: 700, textTransform: 'none' }}
              />
              <Tab
                label="Invite to Platform"
                value="platform"
                sx={{ fontWeight: 700, textTransform: 'none' }}
              />
            </Tabs>
          </Box>

          {inviteMode === 'platform' ? (
            <TextField
              fullWidth
              label="User Email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          ) : (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="teamspace-select-label">
                  Select Teamspace
                </InputLabel>
                <Select
                  labelId="teamspace-select-label"
                  label="Select Teamspace"
                  value={inviteWorkspaceId}
                  onChange={(e) =>
                    setInviteWorkspaceId(e.target.value.toString())
                  }
                >
                  {teams.map((team) => (
                    <MenuItem key={team.teamId} value={team.teamId}>
                      {team.GSI_NAME}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Member Username"
                value={memberUsername}
                onChange={(e) => {
                  setMemberUsername(e.target.value);
                  setUsernameError(false);
                  setUsernameErrorText("");
                }}
                error={usernameError}
                helperText={usernameErrorText}
              />
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenInvite(false)}>Cancel</Button>
          <Button
            onClick={
              inviteMode === "platform"
                ? handlePlatformInvite
                : handleInvite
            }
            variant="contained"
            color="warning"
          >
            {inviteMode === 'platform' ? 'Invite' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* REMOVE MEMBER DIALOG */}
      <Dialog
        open={openRemove}
        onClose={() => setOpenRemove(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 1.5, fontWeight: 600 }}>
            Workspace: {removeWorkspaceName}
          </Typography>
          <TextField
            fullWidth
            label="Member Username"
            value={removeMemberUsername}
            onChange={(e) => setRemoveMemberUsername(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemove(false)}>Cancel</Button>
          <Button
            onClick={handleRemove}
            variant="contained"
            color="warning"
            startIcon={<RemoveCircleOutlineIcon />}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE TEAMSPACE DIALOG */}
      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete Teamspace</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 2 }}>
            This action cannot be undone.
          </Typography>
          <Typography sx={{ mb: 2, fontWeight: 600 }}>
            Workspace: {deleteWorkspaceName}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* MISSING NAME DIALOG */}
      <Dialog open={showNameDialog} onClose={() => {}} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, textAlign: "center" }}>
          Missing Name
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, fontSize: "0.95rem" }}>
            Please insert your name and username in the profile before continuing.
          </Alert>
          <Typography align="center" sx={{ color: "text.secondary" }}>
            Click Edit to change your name and username then click Save.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            onClick={() => {
              setShowNameDialog(false);   
              setProfileOpen(true);     
            }}
            variant="contained"
            color="warning"
            sx={{ fontWeight: 600 }}
          >
            Got It
          </Button>
        </DialogActions>
      </Dialog>


      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() =>
          setSnackbar((prev) => ({
            ...prev,
            open: false,
          }))
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() =>
            setSnackbar((prev) => ({
              ...prev,
              open: false,
            }))
          }
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
