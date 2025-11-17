import React, { useState, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, CircularProgress, Alert, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UserRoleRow from './UserRoleRow';
import * as adminApi from '../../api/admin';
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

export default function UserRoleAssignmentTab() {
  const theme = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([
        adminApi.listUsersWithRoles(),
        adminApi.getAllRoles(),
      ]);
      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleName: string) => {
    await adminApi.assignRole(userId, roleName);
    // Update local state optimistically
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.userId === userId ? { ...user, roleName } : user)),
    );
  };

  // Client-side search filtering
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.roleName.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          User Role Assignments
        </Typography>
        <TextField
          fullWidth
          placeholder="Search by name, username, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            sx: {
              bgcolor: theme.palette.background.paper,
              borderRadius: 1,
            },
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box>
        {filteredUsers.map((user) => (
          <UserRoleRow
            key={user.userId}
            user={user}
            roles={roles}
            onRoleChange={handleRoleChange}
          />
        ))}
      </Box>

      {filteredUsers.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            {searchQuery ? 'No users found matching your search.' : 'No users found.'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
