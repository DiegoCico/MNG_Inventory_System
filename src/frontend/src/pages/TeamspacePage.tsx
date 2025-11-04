import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Stack,
  Toolbar,
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
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import AddIcon from "@mui/icons-material/Add";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
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
import { Tabs, Tab } from "@mui/material";


export interface Team {
  workspaceId: string;
  name: string;
  description?: string;
}

export default function TeamsPage() {
  const theme = useTheme();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteMode, setInviteMode] = useState<"teamspace" | "platform">("teamspace");
  // Dialogs
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Forms
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDesc, setWorkspaceDesc] = useState("");
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [removeWorkspaceId, setRemoveWorkspaceId] = useState("");
  const [removeWorkspaceName, setRemoveWorkspaceName] = useState("");
  const [removeMemberEmail, setRemoveMemberEmail] = useState("");
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState("");
  const [deleteWorkspaceName, setDeleteWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    void refreshTeams();
  }, []);

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) throw new Error("User not authenticated or ID missing");
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

  // Dialog helpers
  function openInviteFor(id: string): void {
    setInviteWorkspaceId(id);
    setOpenInvite(true);
  }

  function openRemoveFor(id: string, name: string): void {
    setRemoveWorkspaceId(id);
    setRemoveWorkspaceName(name);
    setOpenRemove(true);
  }

  function openDeleteFor(id: string, name: string): void {
    setDeleteWorkspaceId(id);
    setDeleteWorkspaceName(name);
    setOpenDelete(true);
  }

  // Actions
  async function handleInviteClick() {
  try {
    const email = inviteEmail.trim();
    if (!email) return alert("Please enter an email.");

    const result = await inviteUser(email);
    console.log("✅ Invite success:", result);
    alert(`Invite sent to ${email}`);
  } catch (err: unknown) {
  if (err instanceof Error) {
    console.error("❌ Invite failed:", err.message);
    alert(`Failed to send invite: ${err.message}`);
  } else {
    console.error("❌ Unknown error:", err);
    alert("Failed to send invite. Please try again.");
  }
}
  }

  async function handleCreate(): Promise<void> {
    try {
      setLoading(true);
      const userId = await getUserId();
      console.log("🎯 Creating teamspace:", {
        userId,
        name: workspaceName,
        description: workspaceDesc,
      });

      await createTeamspace(workspaceName, workspaceDesc, userId);
      setOpenCreate(false);
      setWorkspaceName("");
      setWorkspaceDesc("");
      await refreshTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(): Promise<void> {
    try {
      if (!inviteWorkspaceId) {
        alert("Please select a team first.");
        return;
      }
      setLoading(true);
      const userId = await getUserId();
      await addUserTeamspace(userId, memberEmail, inviteWorkspaceId);
      setOpenInvite(false);
      setInviteWorkspaceId("");
      setMemberEmail("");
      await refreshTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(): Promise<void> {
    try {
      setLoading(true);
      const userId = await getUserId();
      await removeUserTeamspace(userId, removeMemberEmail, removeWorkspaceId);
      setOpenRemove(false);
      setRemoveWorkspaceId("");
      setRemoveWorkspaceName("");
      setRemoveMemberEmail("");
      await refreshTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      setLoading(true);
      const userId = await getUserId();
      await deleteTeamspace(deleteWorkspaceId, userId);
      setOpenDelete(false);
      setDeleteWorkspaceId("");
      setDeleteWorkspaceName("");
      await refreshTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.background.default }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexGrow: 1 }}>
            <MilitaryTechIcon />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
              SupplyNet
            </Typography>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={2}
          mb={2.5}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              color: theme.palette.text.primary,
              letterSpacing: 0.2,
              lineHeight: 1.1,
            }}
          >
            Teamspaces
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setOpenCreate(true)}
              startIcon={<AddIcon />}
              sx={{ fontWeight: 900, textTransform: "none" }}
            >
              Create Team
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setOpenInvite(true)}
              startIcon={<GroupAddIcon />}
              sx={{ fontWeight: 900, textTransform: "none" }}
            >
              Invite Member
            </Button>
          </Stack>
        </Stack>

        {/* Search */}
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

        <Divider sx={{ mb: 3, borderColor: theme.palette.divider }} />

        {/* Loading */}
        {loading && (
          <Box textAlign="center" mt={6}>
            <CircularProgress />
            <Typography sx={{ mt: 2, color: theme.palette.text.secondary }}>
              Loading your teams...
            </Typography>
          </Box>
        )}

        {/* Error */}
        {!loading && error && (
          <Box textAlign="center" mt={6}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {/* Teams */}
        {!loading && !error && filteredTeams.length > 0 && (
          <Grid container spacing={2.5} justifyContent="flex-start">
            {filteredTeams.map((team) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                key={team.workspaceId}
                sx={{ display: "flex", justifyContent: "center" }}
              >
                <TeamIcon
                  id={team.workspaceId}
                  name={team.name}
                  description={team.description}
                  onInvite={() => openInviteFor(team.workspaceId)}
                  onRemove={() => openRemoveFor(team.workspaceId, team.name)}
                  onDelete={() => openDeleteFor(team.workspaceId, team.name)}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Empty */}
        {!loading && !error && filteredTeams.length === 0 && (
          <Box textAlign="center" mt={6}>
            <Typography>No teams found</Typography>
          </Box>
        )}
      </Container>

      {/* Dialogs */}
      {/* CREATE */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="xs">
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

      {/* INVITE */}
<Dialog open={openInvite} onClose={() => setOpenInvite(false)} fullWidth maxWidth="xs">
  <DialogTitle>Invite Member</DialogTitle>
  <DialogContent sx={{ pt: 1 }}>
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
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
          sx={{
            textTransform: "none",
            fontWeight: 700,
            color: inviteMode === "teamspace" ? "warning.main" : "text.secondary",
          }}
        />
        <Tab
          label="Invite to Platform"
          value="platform"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            color: inviteMode === "platform" ? "warning.main" : "text.secondary",
          }}
        />
      </Tabs>
    </Box>

    {inviteMode === "platform" ? (
      <TextField
        fullWidth
        label="User Email"
        value={memberEmail}
        onChange={(e) => setMemberEmail(e.target.value)}
      />
    ) : (
      <>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Select Teamspace</InputLabel>
          <Select
            value={inviteWorkspaceId}
            label="Select Teamspace"
            onChange={(e) => setInviteWorkspaceId(e.target.value)}
          >
            {teams.map((team) => (
              <MenuItem key={team.workspaceId} value={team.workspaceId}>
                {team.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label="Member Email"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
        />
      </>
    )}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setOpenInvite(false)}>Cancel</Button>
    <Button
      onClick={async () => {
        try {
          setLoading(true);
          const userId = await getUserId();

          if (inviteMode === "platform") {
            await inviteUser(memberEmail);
          } else {
            await addUserTeamspace(userId, memberEmail, inviteWorkspaceId);
          }

          setOpenInvite(false);
          setInviteWorkspaceId("");
          setMemberEmail("");
          await refreshTeams();
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      }}
      variant="contained"
      color="warning"
    >
      {inviteMode === "platform" ? "Invite" : "Add"}
    </Button>
  </DialogActions>
</Dialog>

      {/* REMOVE */}
      <Dialog open={openRemove} onClose={() => setOpenRemove(false)} fullWidth maxWidth="xs">
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 1.5, fontWeight: 600 }}>
            Workspace: {removeWorkspaceName}
          </Typography>
          <TextField
            fullWidth
            label="Member Email"
            value={removeMemberEmail}
            onChange={(e) => setRemoveMemberEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemove(false)}>Cancel</Button>
          <Button onClick={handleRemove} variant="contained" color="warning" startIcon={<RemoveCircleOutlineIcon />}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Teamspace</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 2 }}>This action cannot be undone.</Typography>
          <Typography sx={{ mb: 2, fontWeight: 600 }}>
            Workspace: {deleteWorkspaceName}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" startIcon={<DeleteIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
