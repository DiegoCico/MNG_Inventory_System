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
  fetchUserTeams,
  createWorkspace,
  addMemberToWorkspace,
  removeMemberFromWorkspace,
  deleteWorkspace,
  Team,
} from "../api/teamspace";

export default function TeamsPage() {
  const theme = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));

  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void refreshTeams();
  }, []);

  async function refreshTeams(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUserTeams();
      setTeams(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load teams";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function getUserId(): Promise<string> {
    // Replace with authenticated user lookup
    return "mock-user";
  }

  // Prefill workspace data for actions
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

  async function handleCreate(): Promise<void> {
    try {
      setLoading(true);
      await createWorkspace(await getUserId(), workspaceName, workspaceDesc);
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
      await addMemberToWorkspace(await getUserId(), inviteWorkspaceId, memberEmail);
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
      await removeMemberFromWorkspace(await getUserId(), removeWorkspaceId, removeMemberEmail);
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
      await deleteWorkspace(await getUserId(), deleteWorkspaceId);
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
      {/* Top App Bar */}
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
        {/* Header row */}
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
            Workplace
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
            <Typography>No teams assigned yet</Typography>
          </Box>
        )}
      </Container>

      {/* --- CREATE TEAM POPUP --- */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, p: 2.5, minWidth: 420 } }}>
        <DialogTitle>Create New Workspace</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Workspace Name"
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

      {/* --- INVITE MEMBER POPUP --- */}
      <Dialog open={openInvite} onClose={() => setOpenInvite(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, p: 2.5, minWidth: 420 } }}>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Team</InputLabel>
            <Select
              value={inviteWorkspaceId}
              label="Select Team"
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
            label="Member Email or ID"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInvite(false)}>Cancel</Button>
          <Button onClick={handleInvite} variant="contained" color="warning" sx={{ fontWeight: 800 }}>
            Invite
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- REMOVE MEMBER POPUP --- */}
      <Dialog open={openRemove} onClose={() => setOpenRemove(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, p: 2.5, minWidth: 420 } }}>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 1.5, fontWeight: 600 }}>
            Workspace: {removeWorkspaceName}
          </Typography>
          <TextField
            fullWidth
            label="Member Email or ID"
            value={removeMemberEmail}
            onChange={(e) => setRemoveMemberEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemove(false)}>Cancel</Button>
          <Button onClick={handleRemove} variant="contained" color="warning"
            startIcon={<RemoveCircleOutlineIcon />} sx={{ fontWeight: 800 }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- DELETE WORKSPACE POPUP --- */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, p: 2.5, minWidth: 420 } }}>
        <DialogTitle>Delete Teamspace</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ mb: 2 }}>This action cannot be undone.</Typography>
          <Typography sx={{ mb: 2, fontWeight: 600 }}>
            Workspace: {deleteWorkspaceName}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error"
            startIcon={<DeleteIcon />} sx={{ fontWeight: 800 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
