/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
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
          const list = data.members;

          const sorted = [...list].sort((a, b) => {
            const pa = a.permissions?.length ?? 0;
            const pb = b.permissions?.length ?? 0;
            return pb - pa;
          });

          setMembers(sorted);
        }
      } catch {
        showSnackbar('Failed to load members', 'error');
      }
      setLoading(false);
    }

    void load();
  }, [open, teamId]);

  async function handleRemove(username: string) {
    try {
      await removeUserTeamspace(currentUserId, username, teamId);
      showSnackbar('Member removed', 'success');
      const updated = await getTeamMembers(teamId);
      setMembers(updated.members);
    } catch {
      showSnackbar('Failed to remove member', 'error');
    }
  }

  const filtered = members.filter((m) => {
    const t = search.toLowerCase();
    return (
      m.username?.toLowerCase().includes(t) ||
      m.name?.toLowerCase().includes(t) ||
      m.roleName?.toLowerCase().includes(t)
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
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
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
                <Select size="small" value={m.roleName} sx={{ minWidth: 130 }}>
                  <MenuItem value={m.roleName}>{m.roleName}</MenuItem>
                </Select>

                <IconButton color="error" onClick={() => handleRemove(m.username)}>
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
