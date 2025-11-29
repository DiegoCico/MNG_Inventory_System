import React, { useState } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import * as adminApi from '../../api/admin';

interface User {
  userId: string;
  username: string;
  name: string;
  roleName: string;
}

interface Role {
  roleId: string;
  name: string;
}

interface UserRoleRowProps {
  user: User;
  roles: Role[];
  currentUserId: string;
  onRoleChange: (userId: string, roleName: string) => Promise<void>;
  onUserDeleted?: (userId: string) => void;
}

export default function UserRoleRow({
  user,
  roles,
  currentUserId,  
  onRoleChange,
  onUserDeleted,
}: UserRoleRowProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = async (selected: string) => {
    if (user.userId === currentUserId) {
      setError("You cannot change your own role.");
      return;
    }

    if (selected === '__delete_user__') {
      setDeleteDialogOpen(true);
      return;
    }

    if (selected === user.roleName) return;

    setLoading(true);
    setError('');

    try {
      await onRoleChange(user.userId, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    setError('');

    try {
      await adminApi.deleteUser(user.userId);

      if (onUserDeleted) onUserDeleted(user.userId);
      setDeleteDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          mb: 1,
          borderRadius: 1,
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            bgcolor: theme.palette.action.hover,
          },
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            @{user.username}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.name}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 200, display: 'flex', alignItems: 'center', gap: 2 }}>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <FormControl fullWidth size="small">
              <Select
                value={roles.some((r) => r.name === user.roleName) ? user.roleName : ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={loading || user.userId === currentUserId}
                displayEmpty
              >
                {/* DELETE USER OPTION - FIRST ITEM */}
                <MenuItem value="__delete_user__" sx={{ color: 'error.main', fontWeight: 600 }}>
                  Delete User
                </MenuItem>

                {/* Divider via disabled item */}
                <MenuItem disabled sx={{ opacity: 0.5 }}>
                  ───────────────
                </MenuItem>

                {/* NORMAL ROLES */}
                {roles.map((role) => (
                  <MenuItem key={role.roleId} value={role.name}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user <b>@{user.username}</b>? This action cannot be
            undone.
          </DialogContentText>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
