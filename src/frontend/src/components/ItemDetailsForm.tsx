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
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningIcon from '@mui/icons-material/Warning';
import PendingIcon from '@mui/icons-material/Pending';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';

interface ItemDetailsFormProps {
  editedProduct: any;
  setEditedProduct: (v: any) => void;
  itemsList: any[];
  isEditMode: boolean;
  isCreateMode?: boolean;
  alwaysEditableFields?: string[];
}

export default function ItemDetailsForm({
                                          editedProduct,
                                          setEditedProduct,
                                          itemsList,
                                          isEditMode,
                                          isCreateMode = false,
                                          alwaysEditableFields = [],
                                        }: ItemDetailsFormProps) {
  const [itemType, setItemType] = React.useState<'item' | 'kit'>(
    editedProduct?.isKit ? 'kit' : 'item'
  );
  const [parentError, setParentError] = React.useState(false);

  // Safety check - return null if no product data
  if (!editedProduct) {
    return null;
  }

  // DEBUG - Remove after testing
  console.log('ItemDetailsForm Debug:', {
    isCreateMode,
    isEditMode,
    itemType,
    showToggle: isCreateMode && isEditMode,
  });

  const handleChange = (field: string, value: any) => {
    setEditedProduct({ ...editedProduct, [field]: value });

    // Clear parent error when parent is selected
    if (field === 'parent' && value) {
      setParentError(false);
    }
  };

  const handleItemTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: 'item' | 'kit' | null
  ) => {
    if (newType !== null) {
      setItemType(newType);
      setEditedProduct({ ...editedProduct, isKit: newType === 'kit' });

      // Clear parent error if switching to kit (kits don't need parent)
      if (newType === 'kit') {
        setParentError(false);
      }
    }
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

  // Validate parent requirement for items
  React.useEffect(() => {
    if (isCreateMode && itemType === 'item' && !editedProduct.parent) {
      setParentError(true);
    }
  }, [isCreateMode, itemType, editedProduct.parent]);

  return (
    <Stack spacing={2} sx={{ mb: 2, width: '100%', maxWidth: '500px' }}>
      {/* ========== Item Type Toggle (only in create mode) ========== */}
      {isCreateMode && isEditMode && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Type
          </Typography>
          <ToggleButtonGroup
            value={itemType}
            exclusive
            onChange={handleItemTypeChange}
            fullWidth
            color="primary"
          >
            <ToggleButton value="item" sx={{ textTransform: 'none', py: 1.5 }}>
              <CategoryIcon sx={{ mr: 1 }} />
              Item
            </ToggleButton>
            <ToggleButton value="kit" sx={{ textTransform: 'none', py: 1.5 }}>
              <InventoryIcon sx={{ mr: 1 }} />
              Kit
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* ========== Display Name / Army Nomenclature (BOTH) ========== */}
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

      {/* ========== ITEM-SPECIFIC FIELDS ========== */}
      {itemType === 'item' && (
        <>
          {/* Description */}
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

          {/* National Serial Number */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {isEditMode ? (
              <TextField
                label="National Serial Number"
                size="small"
                fullWidth
                value={editedProduct.nsn || ''}
                onChange={(e) => handleChange('nsn', e.target.value)}
                required
              />
            ) : (
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  National Serial Number
                </Typography>
                <Typography>{editedProduct.nsn || '-'}</Typography>
              </Box>
            )}
            {editedProduct.nsn && (
              <Tooltip title="Copy">
                <IconButton size="small" onClick={() => copyToClipboard(editedProduct.nsn)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Serial Number */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {isEditMode ? (
              <TextField
                label="Serial Number"
                size="small"
                fullWidth
                value={editedProduct.serialNumber || ''}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
                required
              />
            ) : (
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Serial Number
                </Typography>
                <Typography>{editedProduct.serialNumber || '-'}</Typography>
              </Box>
            )}
            {editedProduct.serialNumber && (
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(editedProduct.serialNumber)}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Authorized Quantity */}
          {isEditMode ? (
            <TextField
              label="Authorized Quantity"
              type="number"
              size="small"
              fullWidth
              value={editedProduct.authQuantity || 1}
              onChange={(e) => handleChange('authQuantity', parseInt(e.target.value) || 1)}
            />
          ) : (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Quantity
              </Typography>
              <Typography>
                {editedProduct.ohQuantity || 0}/{editedProduct.authQuantity || 0}
              </Typography>
            </Box>
          )}

          {/* OH Quantity - only show in edit mode, not create mode */}
          {isEditMode && !isCreateMode && (
            <TextField
              label="OH Quantity"
              type="number"
              size="small"
              fullWidth
              value={editedProduct.ohQuantity || 1}
              onChange={(e) => handleChange('ohQuantity', parseInt(e.target.value) || 1)}
            />
          )}
        </>
      )}

      {/* ========== KIT-SPECIFIC FIELDS ========== */}
      {itemType === 'kit' && (
        <>
          {/* LIIN */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {isEditMode ? (
              <TextField
                label="LIIN"
                size="small"
                fullWidth
                value={editedProduct.liin || ''}
                onChange={(e) => handleChange('liin', e.target.value)}
                required
              />
            ) : (
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  LIIN
                </Typography>
                <Typography>{editedProduct.liin || '-'}</Typography>
              </Box>
            )}
            {editedProduct.liin && (
              <Tooltip title="Copy">
                <IconButton size="small" onClick={() => copyToClipboard(editedProduct.liin)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* End Item NIIN */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {isEditMode ? (
              <TextField
                label="End Item NIIN"
                size="small"
                fullWidth
                value={editedProduct.endItemNiin || ''}
                onChange={(e) => handleChange('endItemNiin', e.target.value)}
                required
              />
            ) : (
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  End Item NIIN
                </Typography>
                <Typography>{editedProduct.endItemNiin || '-'}</Typography>
              </Box>
            )}
            {editedProduct.endItemNiin && (
              <Tooltip title="Copy">
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(editedProduct.endItemNiin)}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </>
      )}

      {/* ========== Kit From (Parent) - ONLY FOR ITEMS ========== */}
      {itemType === 'item' && (
        <>
          {isEditMode ? (
            <Box>
              <Autocomplete
                options={itemsList.filter((item: any) => item.isKit !== false)}
                getOptionLabel={(option: any) =>
                  `${option.name || option.productName || ''} (${option.actualName || 'No name'})`
                }
                value={editedProduct.parent || null}
                onChange={(_e, val) => handleChange('parent', val)}
                isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Kit From"
                    placeholder="Select parent kit"
                    required
                    error={parentError}
                  />
                )}
              />
              {parentError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  Items must belong to a kit. Please select a parent kit.
                </Alert>
              )}
            </Box>
          ) : (
            editedProduct.parent && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Part of Kit
                </Typography>
                <Typography>
                  {editedProduct.parent.name ||
                    editedProduct.parent.productName ||
                    'Unknown Kit'}
                </Typography>
              </Box>
            )
          )}
        </>
      )}

      {/* ========== Status Buttons (always visible for existing items) ========== */}
      {!isCreateMode && (isEditMode || alwaysEditable('status')) && (
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
