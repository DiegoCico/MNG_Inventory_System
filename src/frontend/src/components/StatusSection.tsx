/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Card, CardHeader, CardContent, Select, MenuItem, Typography, Stack } from '@mui/material';
import { StatusChip } from './Producthelpers';

const STATUSES = ['To Review', 'Completed', 'Shortages', 'Damaged'];

export default function StatusSection({
  editedProduct,
  setEditedProduct,
  isEditMode,
}: {
  editedProduct: any;
  setEditedProduct: (v: any) => void;
  isEditMode: boolean;
}) {
  const handleChange = (v: string) => {
    setEditedProduct({ ...editedProduct, status: v });
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardHeader title="Status" />
      <CardContent>
        {isEditMode ? (
          <Select
            fullWidth
            size="small"
            value={editedProduct.status || 'To Review'}
            onChange={(e) => handleChange(e.target.value)}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography>{editedProduct.status}</Typography>
            <StatusChip value={editedProduct.status} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
