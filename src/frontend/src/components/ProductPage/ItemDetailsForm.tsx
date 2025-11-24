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

  if (!editedProduct) {
    return null;
  }

  const handleChange = (field: string, value: any) => {
    setEditedProduct({ ...editedProduct, [field]: value });

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

  React.useEffect(() => {
    if (isCreateMode && itemType === 'item' && !editedProduct.parent) {
      setParentError(true);
    }
  }, [isCreateMode, itemType, editedProduct.parent]);

  return (
    <Stack spacing={2} sx={{ mb: 2, width: '100%' }}>
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
            <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
              {editedProduct.productName || '-'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Army Nomenclature
            </Typography>
            <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
              {editedProduct.actualName || '-'}
            </Typography>
          </Box>
        </>
      )}

      {itemType === 'item' && (
        <>
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
              <Typography sx={{ wordBreak: 'break-word' }}>{editedProduct.description || 'No description'}</Typography>
            </Box>
          )}

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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  National Serial Number
                </Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{editedProduct.nsn || '-'}</Typography>
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Serial Number
                </Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{editedProduct.serialNumber || '-'}</Typography>
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

          {isEditMode ? (
            <TextField
              label="Authorized Quantity"
              type="number"
              size="small"
              fullWidth
              value={editedProduct.authQuantity || 1}
              onChange={(e) => handleChange('authQuantity', parseInt(e.target.value) || 1)}
              required
            />
          ) : !isCreateMode ? (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Authorized Quantity
              </Typography>
              <Typography>{editedProduct.authQuantity || 0}</Typography>
            </Box>
          ) : null}

          {!isCreateMode && (
            isEditMode || alwaysEditable('ohQuantity') ? (
              <TextField
                label="OH Quantity"
                type="number"
                size="small"
                fullWidth
                value={editedProduct.ohQuantity || 1}
                onChange={(e) => handleChange('ohQuantity', parseInt(e.target.value) || 1)}
              />
            ) : (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  OH Quantity
                </Typography>
                <Typography>
                  {editedProduct.ohQuantity || 0}/{editedProduct.authQuantity || 0}
                </Typography>
              </Box>
            )
          )}
        </>
      )}

      {itemType === 'kit' && (
        <>
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  LIIN
                </Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{editedProduct.liin || '-'}</Typography>
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  End Item NIIN
                </Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{editedProduct.endItemNiin || '-'}</Typography>
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

      {itemType === 'item' && isEditMode && (
        <Box>
          <Autocomplete
            options={itemsList.filter((item: any) => item.isKit !== false)}
            getOptionLabel={(option: any) =>
              `${option.name || option.productName || ''} (${option.actualName || 'No name'})`
            }
            value={editedProduct.parent || null}
            onChange={(_e, val) => {
              if (val) {
                const cleanParent = typeof val === 'string' ? val : (val.itemId || val);
                handleChange('parent', cleanParent);
              } else {
                handleChange('parent', null);
              }
            }}
            isOptionEqualToValue={(o, v) => {
              const oId = typeof o === 'string' ? o : o.itemId;
              const vId = typeof v === 'string' ? v : v?.itemId;
              return oId === vId;
            }}
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
        </Box>
      )}

      {!isCreateMode && (isEditMode || alwaysEditable('status')) && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Status
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {statuses.map((s) => (
              <Button
                key={s.value}
                onClick={() => handleChange('status', s.value)}
                variant={editedProduct.status === s.value ? 'contained' : 'outlined'}
                startIcon={s.icon}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  px: { xs: 0.75, sm: 1 },
                  py: { xs: 0.5, sm: 0.75 },
                  fontWeight: editedProduct.status === s.value ? 700 : 500,
                  bgcolor: editedProduct.status === s.value ? s.color : 'transparent',
                  color: editedProduct.status === s.value ? 'white' : s.color,
                  borderColor: s.color,
                  '&:hover': {
                    bgcolor: editedProduct.status === s.value ? s.color : `${s.color}20`,
                    borderColor: s.color,
                  },
                }}
              >
                {s.label}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

      {(isEditMode || alwaysEditable('notes')) && (
        <TextField
          label="Notes / Last Known Location"
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
