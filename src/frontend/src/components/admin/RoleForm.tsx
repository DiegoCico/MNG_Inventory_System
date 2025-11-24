import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PermissionCheckboxGroup, { Permission } from './PermissionCheckboxGroup';

interface RoleFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RoleFormData) => Promise<void>;
  mode: 'create' | 'edit';
  initialData?: RoleFormData;
  title?: string;
  readOnly?: boolean;
}

export interface RoleFormData {
  name: string;
  description: string;
  permissions: Permission[];
}

export default function RoleForm({
  open,
  onClose,
  onSubmit,
  mode,
  initialData,
  title,
  readOnly = false,
}: RoleFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when opened with initial data
  useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setPermissions(initialData?.permissions || []);
      setError('');
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    if (permissions.length === 0) {
      setError('At least one permission must be selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        permissions,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: theme.palette.background.default,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>
        {title || (readOnly ? 'View Role' : mode === 'create' ? 'Create New Role' : 'Edit Role')}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Role Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading || readOnly}
          required
          sx={{ mt: 1, mb: 2, bgcolor: theme.palette.background.paper }}
        />

        <TextField
          label="Description (optional)"
          fullWidth
          multiline
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading || readOnly}
          sx={{ mb: 3, bgcolor: theme.palette.background.paper }}
        />

        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          <PermissionCheckboxGroup
            selected={permissions}
            onChange={setPermissions}
            disabled={loading || readOnly}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
        {!readOnly && (
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : mode === 'create' ? 'Create Role' : 'Save Changes'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
