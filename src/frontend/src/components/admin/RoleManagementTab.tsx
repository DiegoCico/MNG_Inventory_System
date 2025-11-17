import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RoleCard from './RoleCard';
import RoleForm, { RoleFormData } from './RoleForm';
import { Permission } from './PermissionCheckboxGroup';
import * as adminApi from '../../api/admin';

interface Role {
  roleId: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

const DEFAULT_ROLES = ['Owner', 'Manager', 'Member'];

export default function RoleManagementTab() {
  const theme = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getAllRoles();
      setRoles(data.roles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (data: RoleFormData) => {
    await adminApi.createRole(data.name, data.description, data.permissions);
    await loadRoles();
  };

  const handleEditRole = async (data: RoleFormData) => {
    if (!selectedRole) return;
    await adminApi.updateRole(selectedRole.name, data.description, data.permissions);
    await loadRoles();
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await adminApi.deleteRole(roleToDelete.name);
      await loadRoles();
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const openCreateDialog = () => {
    setFormMode('create');
    setSelectedRole(null);
    setFormOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setFormMode('edit');
    setSelectedRole(role);
    setFormOpen(true);
  };

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        (role.description?.toLowerCase() || '').includes(query),
    );
  }, [roles, searchQuery]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Roles
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Create Role
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Search roles by name or description..."
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
        sx={{ mb: 3 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="stretch">
        {filteredRoles.map((role) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role.roleId}>
            <RoleCard
              name={role.name}
              description={role.description}
              permissions={role.permissions}
              isDefault={DEFAULT_ROLES.includes(role.name)}
              onEdit={() => openEditDialog(role)}
              onDelete={() => openDeleteDialog(role)}
            />
          </Grid>
        ))}
      </Grid>

      {filteredRoles.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            {searchQuery
              ? 'No roles found matching your search.'
              : 'No roles found. Create your first role to get started.'}
          </Typography>
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <RoleForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={formMode === 'create' ? handleCreateRole : handleEditRole}
        mode={formMode}
        initialData={
          selectedRole
            ? {
                name: selectedRole.name,
                description: selectedRole.description || '',
                permissions: selectedRole.permissions,
              }
            : undefined
        }
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: { bgcolor: theme.palette.background.paper },
        }}
      >
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteRole} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
