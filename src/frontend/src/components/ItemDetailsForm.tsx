/* eslint-disable */
import React from 'react';
import {
  TextField,
  Autocomplete,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  Box,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningIcon from '@mui/icons-material/Warning';
import PendingIcon from '@mui/icons-material/Pending';

interface ItemDetailsFormProps {
  editedProduct: any;
  setEditedProduct: (v: any) => void;
  itemsList: any[];
  isEditMode: boolean;
  alwaysEditableFields?: string[];
}

export default function ItemDetailsForm({
  editedProduct,
  setEditedProduct,
  itemsList,
  isEditMode,
  alwaysEditableFields = [],
}: ItemDetailsFormProps) {
  const handleChange = (field: string, value: any) => {
    setEditedProduct({ ...editedProduct, [field]: value });
  };

  const copyToClipboard = (text: string) => {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  };

  const alwaysEditable = (field: string) => alwaysEditableFields.includes(field);

  const statuses = [
    { value: 'To Review', label: 'To Review', icon: <PendingIcon />, color: '#9e9e9e' },
    { value: 'Completed', label: 'Complete', icon: <CheckCircleIcon />, color: '#4caf50' },
    { value: 'Damaged', label: 'Damaged', icon: <ReportProblemIcon />, color: '#f44336' },
    { value: 'Shortages', label: 'Shortage', icon: <WarningIcon />, color: '#ff9800' },
  ];

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {/* ========== Product Name / Item Name ========== */}
      {isEditMode ? (
        <>
          <TextField
            label="Display Name"
            size="small"
            fullWidth
            value={editedProduct.productName || ''}
            onChange={(e) => handleChange('productName', e.target.value)}
            required
          />
          <TextField
            label="Army Nomenclature"
            size="small"
            fullWidth
            value={editedProduct.actualName || ''}
            onChange={(e) => handleChange('actualName', e.target.value)}
            required
          />
        </>
      ) : (
        <>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Display Name
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {editedProduct.productName || '-'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Army Nomenclature
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {editedProduct.actualName || '-'}
            </Typography>
          </Box>
        </>
      )}

      {/* ========== Serial Number ========== */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {isEditMode ? (
          <TextField
            label="Serial Number (NSN)"
            size="small"
            fullWidth
            value={editedProduct.serialNumber || ''}
            onChange={(e) => handleChange('serialNumber', e.target.value)}
            required
          />
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Serial Number
            </Typography>
            <Typography>{editedProduct.serialNumber || '-'}</Typography>
          </Box>
        )}
        {editedProduct.serialNumber && (
          <Tooltip title="Copy">
            <IconButton size="small" onClick={() => copyToClipboard(editedProduct.serialNumber)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* ========== Quantity ========== */}
      {isEditMode ? (
        <TextField
          label="Quantity"
          type="number"
          size="small"
          fullWidth
          value={editedProduct.quantity || 1}
          onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
        />
      ) : (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Quantity
          </Typography>
          <Typography>{editedProduct.quantity}</Typography>
        </Box>
      )}

      {/* ========== Description ========== */}
      {isEditMode || alwaysEditable('description') ? (
        <TextField
          label="Description"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={editedProduct.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          required={isEditMode}
        />
      ) : (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Description
          </Typography>
          <Typography>{editedProduct.description || 'No description'}</Typography>
        </Box>
      )}

      {/* ========== Kit From (Parent) ========== */}
      {isEditMode ? (
        <Autocomplete
          options={itemsList}
          getOptionLabel={(option: any) =>
            `${option.name || ''} (${option.actualName || 'No name'})`
          }
          value={editedProduct.parent || null}
          onChange={(_e, val) => handleChange('parent', val)}
          isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
          renderInput={(params) => (
            <TextField {...params} label="Kit From" placeholder="Select parent item" />
          )}
        />
      ) : (
        editedProduct.parent && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Part of Kit
            </Typography>
            <Typography>{editedProduct.parent.name || 'Unknown Kit'}</Typography>
          </Box>
        )
      )}

      {/* ========== Status Buttons (always visible for existing items) ========== */}
      {(isEditMode || alwaysEditable('status')) && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Status
          </Typography>
          <ButtonGroup fullWidth orientation="vertical" sx={{ gap: 1 }}>
            {statuses.map((s) => (
              <Button
                key={s.value}
                onClick={() => handleChange('status', s.value)}
                variant={editedProduct.status === s.value ? 'contained' : 'outlined'}
                startIcon={s.icon}
                sx={{
                  textTransform: 'none',
                  fontWeight: editedProduct.status === s.value ? 700 : 500,
                  bgcolor: editedProduct.status === s.value ? s.color : 'transparent',
                  color: editedProduct.status === s.value ? 'white' : s.color,
                  borderColor: s.color,
                  justifyContent: 'flex-start',
                  py: 1.5,
                  '&:hover': {
                    bgcolor: editedProduct.status === s.value ? s.color : `${s.color}20`,
                    borderColor: s.color,
                  },
                }}
              >
                {s.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
      )}

      {/* ========== Notes  ========== */}
      {(isEditMode || alwaysEditable('notes')) && (
        <TextField
          label="Notes"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={editedProduct.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Add notes..."
        />
      )}
    </Stack>
  );
}
