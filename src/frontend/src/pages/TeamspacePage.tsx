/* eslint-disable @typescript-eslint/no-explicit-any */
// TeamspacePage.tsx - Main page component
import { useEffect, useState, useMemo } from 'react';
import { Box, Container, Divider, Snackbar, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import { getTeamspace } from '../api/teamspace';
import { me } from '../api/auth';

// Components
import TeamsHeader from '../components/TeamspacePage/TeamsHeader';
import TeamsSearch from '../components/TeamspacePage/TeamsSearch';
import TeamsGrid, { Team } from '../components/TeamspacePage/TeamsGrid';
import EmptyState from '../components/TeamspacePage/EmptyState';

// Dialogs
import {
  CreateTeamDialog,
  InviteDialog,
  RemoveMemberDialog,
  DeleteTeamDialog,
  MissingNameDialog,
} from '../components/TeamspacePage/TeamspaceDialogs';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

export default function TeamspacePage() {
  const theme = useTheme();

  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile state
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);

  // Dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Remove/Delete state
  const [removeWorkspaceId, setRemoveWorkspaceId] = useState('');
  const [removeWorkspaceName, setRemoveWorkspaceName] = useState('');
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState('');
  const [deleteWorkspaceName, setDeleteWorkspaceName] = useState('');

  // Snackbar state
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Helper functions
  function showSnackbar(message: string, severity: 'success' | 'error') {
    setSnackbar({ open: true, message, severity });
  }

  function closeSnackbar() {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }

  async function refreshTeams(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const user = await me();
      if (!user?.userId) {
        throw new Error('User not authenticated or ID missing');
      }
      const data = await getTeamspace(user.userId);
      setTeams(data?.teams ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load teams';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Check user profile on mount
  useEffect(() => {
    async function checkUserProfile() {
      try {
        const user = await me();
        if (!user?.name || user.name.trim() === '' || user.name === 'User') {
          setProfileOpen(true);
          setShowNameDialog(true);
        } else {
          await refreshTeams();
        }
      } catch (err) {
        console.error('Error checking user profile:', err);
        await refreshTeams();
      }
    }

    void checkUserProfile();
  }, []);

  // Handle profile close
  async function handleProfileClose() {
    setProfileOpen(false);
    const user = await me();
    if (!user?.name || user.name.trim() === '' || user.name === 'User') {
      setShowNameDialog(true);
    } else {
      setShowNameDialog(false);
      await refreshTeams();
    }
  }

  function openProfile() {
    setShowNameDialog(false);
    setProfileOpen(true);
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

  // Filtered teams
  const filteredTeams = useMemo(
    () => teams.filter((t) => t.GSI_NAME.toLowerCase().includes(search.toLowerCase())),
    [teams, search]
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} onProfileClick={() => setProfileOpen(true)} />

      <Profile open={profileOpen} onClose={handleProfileClose} />

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <TeamsHeader
          onCreateTeam={() => setOpenCreate(true)}
          onInviteMember={() => setOpenInvite(true)}
        />

        <TeamsSearch value={search} onChange={setSearch} />

        <Divider sx={{ mb: 3 }} />

        <EmptyState
          loading={loading}
          error={error}
          isEmpty={filteredTeams.length === 0 && !loading && !error}
        />

        {!loading && !error && filteredTeams.length > 0 && (
          <TeamsGrid
            teams={filteredTeams}
            onInvite={() => setOpenInvite(true)}
            onRemove={openRemoveFor}
            onDelete={openDeleteFor}
          />
        )}
      </Container>

      {/* Dialogs */}
      <CreateTeamDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        teams={teams}
        onRefresh={refreshTeams}
        showSnackbar={showSnackbar}
      />

      <InviteDialog
        open={openInvite}
        onClose={() => setOpenInvite(false)}
        teams={teams}
        onRefresh={refreshTeams}
        showSnackbar={showSnackbar}
      />

      <RemoveMemberDialog
        open={openRemove}
        onClose={() => setOpenRemove(false)}
        workspaceId={removeWorkspaceId}
        workspaceName={removeWorkspaceName}
        teams={teams}
        onRefresh={refreshTeams}
        showSnackbar={showSnackbar}
      />

      <DeleteTeamDialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        workspaceId={deleteWorkspaceId}
        workspaceName={deleteWorkspaceName}
        teams={teams}
        onRefresh={refreshTeams}
        showSnackbar={showSnackbar}
      />

      <MissingNameDialog open={showNameDialog} onOpenProfile={openProfile} />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}