import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Permission } from './PermissionCheckboxGroup';

interface RoleCardProps {
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RoleCard({
  name,
  description,
  permissions,
  isDefault = false,
  onEdit,
  onDelete,
}: RoleCardProps) {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {name}
          </Typography>
          {isDefault && <Chip label="Default" size="small" color="primary" variant="outlined" />}
        </Box>

        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
          {permissions.length} Permission{permissions.length !== 1 ? 's' : ''}
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Tooltip title={isDefault ? 'View permissions' : 'Edit role'}>
          <span>
            <IconButton size="small" onClick={onEdit} color="primary">
              {isDefault ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={isDefault ? 'Default roles cannot be deleted' : 'Delete role'}>
          <span>
            <IconButton size="small" onClick={onDelete} disabled={isDefault} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
