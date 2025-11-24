import React from 'react';
import { Box, FormControl, FormGroup, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export type Permission =
  // Team management
  | 'team.create'
  | 'team.add_member'
  | 'team.remove_member'
  | 'team.view'
  | 'team.delete'
  // User management
  | 'user.invite'
  | 'user.delete'
  | 'user.assign_roles'
  // Role management
  | 'role.add'
  | 'role.modify'
  | 'role.remove'
  | 'role.view'
  // Item management
  | 'item.create'
  | 'item.view'
  | 'item.update'
  | 'item.delete'
  | 'item.reset'
  // Report handling
  | 'reports.create'
  | 'reports.view'
  | 'reports.delete';

interface PermissionCategory {
  label: string;
  icon: string;
  permissions: { value: Permission; label: string }[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: 'Team Management',
    icon: '🏢',
    permissions: [
      { value: 'team.create', label: 'Create Teams' },
      { value: 'team.add_member', label: 'Add Members' },
      { value: 'team.remove_member', label: 'Remove Members' },
      { value: 'team.view', label: 'View Teams' },
      { value: 'team.delete', label: 'Delete Teams' },
    ],
  },
  {
    label: 'User Management',
    icon: '👥',
    permissions: [
      { value: 'user.invite', label: 'Invite Users' },
      { value: 'user.assign_roles', label: 'Assign Roles to Users' },
      { value: 'user.delete', label: 'Delete Users' },
    ],
  },
  {
    label: 'Role Management',
    icon: '🔐',
    permissions: [
      { value: 'role.add', label: 'Create Roles' },
      { value: 'role.modify', label: 'Modify Roles' },
      { value: 'role.remove', label: 'Delete Roles' },
      { value: 'role.view', label: 'View Roles' },
    ],
  },
  {
    label: 'Item Management',
    icon: '📦',
    permissions: [
      { value: 'item.create', label: 'Create Items' },
      { value: 'item.view', label: 'View Items' },
      { value: 'item.update', label: 'Update Items' },
      { value: 'item.delete', label: 'Delete Items' },
      { value: 'item.reset', label: 'Reset Inventory' },
    ],
  },
  {
    label: 'Report Management',
    icon: '📋',
    permissions: [
      { value: 'reports.create', label: 'Create PDFs' },
      { value: 'reports.view', label: 'View PDFs' },
      { value: 'reports.delete', label: 'Delete PDFs' },
    ],
  },
];

interface PermissionCheckboxGroupProps {
  selected: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

export default function PermissionCheckboxGroup({
  selected,
  onChange,
  disabled = false,
}: PermissionCheckboxGroupProps) {
  const theme = useTheme();

  const handleToggle = (permission: Permission) => {
    const isSelected = selected.includes(permission);
    if (isSelected) {
      onChange(selected.filter((p) => p !== permission));
    } else {
      onChange([...selected, permission]);
    }
  };

  const handleSelectAll = (category: PermissionCategory) => {
    const categoryPermissions = category.permissions.map((p) => p.value);
    const allSelected = categoryPermissions.every((p) => selected.includes(p));

    if (allSelected) {
      // Deselect all in this category
      onChange(selected.filter((p) => !categoryPermissions.includes(p)));
    } else {
      // Select all in this category
      const newSelected = [...selected];
      categoryPermissions.forEach((p) => {
        if (!newSelected.includes(p)) {
          newSelected.push(p);
        }
      });
      onChange(newSelected);
    }
  };

  return (
    <Box>
      {PERMISSION_CATEGORIES.map((category) => {
        const categoryPermissions = category.permissions.map((p) => p.value);
        const allSelected = categoryPermissions.every((p) => selected.includes(p));
        const someSelected = categoryPermissions.some((p) => selected.includes(p));

        return (
          <Box
            key={category.label}
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <FormControl component="fieldset" variant="standard" fullWidth>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={() => handleSelectAll(category)}
                      disabled={disabled}
                    />
                  }
                  label={
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {category.icon} {category.label}
                    </Typography>
                  }
                />
              </Box>
              <FormGroup sx={{ ml: 4 }}>
                {category.permissions.map((perm) => (
                  <FormControlLabel
                    key={perm.value}
                    control={
                      <Checkbox
                        checked={selected.includes(perm.value)}
                        onChange={() => handleToggle(perm.value)}
                        disabled={disabled}
                      />
                    }
                    label={perm.label}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Box>
        );
      })}
    </Box>
  );
}
