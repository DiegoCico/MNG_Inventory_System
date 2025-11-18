// dialogs/TeamspaceDialogs.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Box,
  Alert,
} from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import { Team } from '../components/TeamspacePage/TeamsGrid';
import {
  createTeamspace,
  addUserTeamspace,
  removeUserTeamspace,
  deleteTeamspace,
} from '../../api/teamspace';
import { me, inviteUser } from '../../api/auth';

interface DialogsProps {
  teams: Team[];
  onRefresh: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error') => void;
}

// CREATE TEAM DIALOG
interface CreateTeamDialogProps extends DialogsProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamDialog({ open, onClose, onRefresh, showSnackbar }: CreateTeamDialogProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDesc, setWorkspaceDesc] = useState('');
  const [loading, setLoading] = useState(false);

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) {
      throw new Error('User not authenticated or ID missing');
    }
    return user.userId;
  }

  async function handleCreate() {
    try {
      setLoading(true);
      const userId = await getUserId();
      const result = await createTeamspace(workspaceName, workspaceDesc, userId);

      if (!result?.success) {
        showSnackbar(result.error || 'Failed to create team.', 'error');
        return;
      }

      showSnackbar('Teamspace created successfully!', 'success');
      setWorkspaceName('');
      setWorkspaceDesc('');
      onClose();
      await onRefresh();
    } catch (err) {
      console.error('❌ handleCreate error:', err);
      showSnackbar('Error creating team.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleCreate} variant="contained" color="primary" disabled={loading}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// INVITE DIALOG
interface InviteDialogProps extends DialogsProps {
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ open, onClose, teams, onRefresh, showSnackbar }: InviteDialogProps) {
  const [inviteMode, setInviteMode] = useState<'teamspace' | 'platform'>('teamspace');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [usernameError, setUsernameError] = useState(false);
  const [usernameErrorText, setUsernameErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setInviteWorkspaceId('');
      setMemberUsername('');
      setUsernameError(false);
      setUsernameErrorText('');
      setInviteEmail('');
    }
  }, [open]);

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) {
      throw new Error('User not authenticated or ID missing');
    }
    return user.userId;
  }

  async function handleInviteToTeamspace() {
    try {
      setUsernameError(false);
      setUsernameErrorText('');
      setLoading(true);

      if (!inviteWorkspaceId) {
        showSnackbar('Please select a teamspace.', 'error');
        return;
      }

      const cleanUsername = memberUsername.trim();
      if (!cleanUsername) {
        setUsernameError(true);
        setUsernameErrorText('Please enter a username.');
        return;
      }

      const userId = await getUserId();
      const result = await addUserTeamspace(userId, cleanUsername, inviteWorkspaceId);

      if (!result?.success) {
        if (result?.error?.toLowerCase().includes('not found')) {
          setUsernameError(true);
          setUsernameErrorText('Username not found.');
        }
        showSnackbar(result?.error || 'Failed to add member.', 'error');
        return;
      }

      showSnackbar(`User "${cleanUsername}" added to teamspace.`, 'success');
      onClose();
      await onRefresh();
    } catch (err) {
      console.error('❌ handleInvite error:', err);
      showSnackbar('Unexpected error adding member.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePlatformInvite() {
    try {
      const email = inviteEmail.trim();
      if (!email) {
        showSnackbar('Please enter a valid email.', 'error');
        return;
      }

      await inviteUser(email);
      showSnackbar(`Invitation sent to ${email}`, 'success');
      onClose();
    } catch (err) {
      console.error('❌ Invite failed:', err);
      showSnackbar('Failed to send invite.', 'error');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
              <InputLabel id="teamspace-select-label">Select Teamspace</InputLabel>
              <Select
                labelId="teamspace-select-label"
                label="Select Teamspace"
                value={inviteWorkspaceId}
                onChange={(e) => setInviteWorkspaceId(e.target.value.toString())}
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
                setUsernameErrorText('');
              }}
              error={usernameError}
              helperText={usernameErrorText}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={inviteMode === 'platform' ? handlePlatformInvite : handleInviteToTeamspace}
          variant="contained"
          color="warning"
          disabled={loading}
        >
          {inviteMode === 'platform' ? 'Invite' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// REMOVE MEMBER DIALOG
interface RemoveMemberDialogProps extends DialogsProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function RemoveMemberDialog({
  open,
  onClose,
  workspaceId,
  workspaceName,
  onRefresh,
  showSnackbar,
}: RemoveMemberDialogProps) {
  const [memberUsername, setMemberUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) {
      throw new Error('User not authenticated or ID missing');
    }
    return user.userId;
  }

  async function handleRemove() {
    try {
      setLoading(true);

      const cleanUsername = memberUsername.trim();
      if (!cleanUsername) {
        showSnackbar('Please enter a member username.', 'error');
        return;
      }

      if (!workspaceId) {
        showSnackbar('Workspace ID missing.', 'error');
        return;
      }

      const userId = await getUserId();
      const result = await removeUserTeamspace(userId, cleanUsername, workspaceId);

      if (!result?.success) {
        showSnackbar(result?.error || 'Failed to remove member.', 'error');
        return;
      }

      showSnackbar('Member removed successfully.', 'success');
      setMemberUsername('');
      onClose();
      await onRefresh();
    } catch (err) {
      console.error('❌ handleRemove error:', err);
      showSnackbar('Error removing member.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Remove Member</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ mb: 1.5, fontWeight: 600 }}>Workspace: {workspaceName}</Typography>
        <TextField
          fullWidth
          label="Member Username"
          value={memberUsername}
          onChange={(e) => setMemberUsername(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleRemove}
          variant="contained"
          color="warning"
          startIcon={<RemoveCircleOutlineIcon />}
          disabled={loading}
        >
          Remove
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// DELETE TEAM DIALOG
interface DeleteTeamDialogProps extends DialogsProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function DeleteTeamDialog({
  open,
  onClose,
  workspaceId,
  workspaceName,
  onRefresh,
  showSnackbar,
}: DeleteTeamDialogProps) {
  const [loading, setLoading] = useState(false);

  async function getUserId(): Promise<string> {
    const user = await me();
    if (!user?.userId) {
      throw new Error('User not authenticated or ID missing');
    }
    return user.userId;
  }

  async function handleDelete() {
    try {
      setLoading(true);
      const userId = await getUserId();
      const result = await deleteTeamspace(workspaceId, userId);

      if (!result?.success) {
        showSnackbar(result?.error || 'Failed to delete team.', 'error');
        return;
      }

      showSnackbar('Teamspace deleted successfully.', 'success');
      onClose();
      await onRefresh();
    } catch (err) {
      console.error('❌ handleDelete error:', err);
      showSnackbar('Error deleting team.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete Teamspace</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ mb: 2 }}>This action cannot be undone.</Typography>
        <Typography sx={{ mb: 2, fontWeight: 600 }}>Workspace: {workspaceName}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={loading}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// MISSING NAME DIALOG
interface MissingNameDialogProps {
  open: boolean;
  onOpenProfile: () => void;
}

export function MissingNameDialog({ open, onOpenProfile }: MissingNameDialogProps) {
  return (
    <Dialog open={open} onClose={() => {}} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>Missing Name</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.95rem' }}>
          Please insert your name and username in the profile before continuing.
        </Alert>
        <Typography align="center" sx={{ color: 'text.secondary' }}>
          Click Edit to change your name and username then click Save.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onOpenProfile} variant="contained" color="warning" sx={{ fontWeight: 600 }}>
          Got It
        </Button>
      </DialogActions>
    </Dialog>
  );
}