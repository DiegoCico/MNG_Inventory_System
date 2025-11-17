import React, { useState } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

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
  onRoleChange: (userId: string, roleName: string) => Promise<void>;
}

export default function UserRoleRow({ user, roles, onRoleChange }: UserRoleRowProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async (newRoleName: string) => {
    if (newRoleName === user.roleName) return;

    setLoading(true);
    setError('');

    try {
      await onRoleChange(user.userId, newRoleName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  return (
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
          {user.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          @{user.username}
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
              disabled={loading}
              displayEmpty
              renderValue={(selected) =>
                selected === '' ? (
                  <Typography color="text.secondary">Unassigned</Typography>
                ) : (
                  String(selected)
                )
              }
            >
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
  );
}
