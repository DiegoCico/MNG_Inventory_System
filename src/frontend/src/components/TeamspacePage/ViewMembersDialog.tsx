/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, ChangeEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Box,
  Stack,
  Avatar,
  MenuItem,
  Select,
  Button,
  CircularProgress,
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

import { getTeamMembers, removeUserTeamspace } from '../../api/teamspace';
import { me } from '../../api/auth';

interface ViewMembersDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  showSnackbar: (msg: string, sev: 'success' | 'error') => void;
}

export default function ViewMembersDialog({
  open,
  onClose,
  teamId,
  teamName,
  showSnackbar,
}: ViewMembersDialogProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);

      try {
        const user = await me();
        setCurrentUserId(user.userId);

        const data = await getTeamMembers(teamId);

        if (data?.success) {
          setMembers(data.members);
        }
      } catch (e) {
        showSnackbar('Failed to load members', 'error');
      }

      setLoading(false);
    }

    void load();
  }, [open, teamId]);

  async function handleRemove(memberUsername: string) {
    try {
      await removeUserTeamspace(currentUserId, memberUsername, teamId);
      showSnackbar('Member removed', 'success');

      // Refresh list
      const updated = await getTeamMembers(teamId);
      setMembers(updated.members);
    } catch (err) {
      showSnackbar('Failed to remove member', 'error');
    }
  }

  const filtered = members.filter((m) => {
    const term = search.toLowerCase();
    return (
      m.username?.toLowerCase().includes(term) ||
      m.name?.toLowerCase().includes(term) ||
      m.role?.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        Members – {teamName}
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name, username, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 3 }}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading &&
          filtered.map((m) => (
            <Stack
              key={m.userId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                py: 1.5,
                borderBottom: '1px solid #eee',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ width: 42, height: 42, fontWeight: 700 }}>
                  {m.name ? m.name[0].toUpperCase() : '?'}
                </Avatar>

                <Box>
                  <Typography fontWeight={600}>@{m.username}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {m.name}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Select
                  size="small"
                  value={m.role}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="Owner">Owner</MenuItem>
                  <MenuItem value="Member">Member</MenuItem>
                </Select>

                <IconButton
                  color="error"
                  onClick={() => handleRemove(m.username)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Stack>
          ))}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
        onClick={onClose}
        variant="outlined"
        sx={{
            borderColor: 'rgba(0,0,0,0.3)',
            color: 'rgba(0,0,0,0.7)',
            fontWeight: 600,
            '&:hover': {
            borderColor: 'rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(0,0,0,0.04)',
            },
        }}
        >
        Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
