/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Stack,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { createItem, deleteItem, updateItem } from '../../api/items';
import { useNavigate } from 'react-router-dom';
import ErrorDialog from '../ErrorDialog';

export default function ActionPanel({
  isCreateMode,
  isEditMode,
  setIsEditMode,
  product,
  editedProduct,
  teamId,
  itemId,
  selectedImageFile,
  imagePreview,
  setShowSuccess,
  damageReports,
  setFieldErrors,
}: any) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const updateChildrenStatus = async (children: any[], newStatus: string) => {
    for (const child of children) {
      try {
        await updateItem(teamId, child.itemId, { status: newStatus });
        if (child.children?.length > 0) {
          await updateChildrenStatus(child.children, newStatus);
        }
      } catch (err) {
        console.error(`Failed to update child ${child.itemId}:`, err);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteItem(teamId, itemId);
      setDeleteOpen(false);
      navigate(`/teams/to-review/${teamId}`);
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMessage('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const validateFields = () => {
    const newErrors: Record<string, boolean> = {};

    // Required fields for all
    if (!editedProduct.productName?.trim()) {
      newErrors.productName = true;
    }

    if (!editedProduct.actualName?.trim()) {
      newErrors.actualName = true;
    }

    // Item-specific required fields
    if (!editedProduct.isKit) {
      if (!editedProduct.nsn?.trim()) {
        newErrors.nsn = true;
      }

      if (!editedProduct.description?.trim()) {
        newErrors.description = true;
      }

      // Validate Authorized Quantity for items
      const authQty = parseInt(editedProduct.authQuantity);
      if (isNaN(authQty) || authQty < 0) {
        newErrors.authQuantity = true;
      }

      // Always validate that Authorized >= OH for items (OH exists even when not visible)
      const ohQty = parseInt(editedProduct.ohQuantity) || 0;
      if (!isNaN(authQty) && !isNaN(ohQty) && authQty < ohQty) {
        newErrors.authQuantity = true;
      }

      // Validate OH Quantity if status is Shortages (field is visible)
      if (editedProduct.status === 'Shortages') {
        if (isNaN(ohQty) || ohQty < 0) {
          newErrors.ohQuantity = true;
        }

        // OH must also be less than or equal to Authorized
        if (!isNaN(ohQty) && !isNaN(authQty) && ohQty > authQty) {
          newErrors.ohQuantity = true;
        }
      }
    } else {
      // Kit-specific required fields
      if (!editedProduct.liin?.trim()) {
        newErrors.liin = true;
      }

      if (!editedProduct.endItemNiin?.trim()) {
        newErrors.endItemNiin = true;
      }
    }

    // Items must have a parent in create mode
    if (isCreateMode && !editedProduct.isKit && !editedProduct.parent) {
      newErrors.parent = true;
    }

    if (setFieldErrors) {
      setFieldErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (isQuickUpdate = false) => {
    try {
      // Validate all fields
      if (!validateFields()) {
        // Check for specific Authorized < OH error
        const authQty = parseInt(editedProduct.authQuantity) || 0;
        const ohQty = parseInt(editedProduct.ohQuantity) || 0;

        if (!editedProduct.isKit && authQty < ohQty) {
          setErrorMessage('Authorized Quantity must be greater than or equal to OH Quantity');
          return;
        }

        setErrorMessage('Please fill in all required fields correctly');
        return;
      }

      // Require image for both items and kits
      if (isCreateMode && !imagePreview) {
        setErrorMessage('Please add an image before creating the item');
        return;
      }

      // Clear any previous errors
      if (setFieldErrors) {
        setFieldErrors({});
      }

      // Convert new image → base64 if selected
      let imageBase64: string | undefined = undefined;
      if (selectedImageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((res) => {
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(selectedImageFile);
        });
      }

      const nameValue =
        editedProduct.productName ||
        editedProduct.actualName ||
        `Item-${editedProduct.serialNumber || 'Unknown'}`;

      if (isCreateMode) {
        // For kits: use endItemNiin as NSN, use liin as serialNumber
        // For items: use nsn and serialNumber as normal
        const res = await createItem(
          teamId,
          nameValue,
          editedProduct.actualName || nameValue,
          imageBase64,
          editedProduct.description || '',
          editedProduct.parent || null,
          editedProduct.isKit || false,
          editedProduct.isKit ? editedProduct.endItemNiin || '' : editedProduct.nsn || '',
          editedProduct.isKit ? editedProduct.liin || '' : editedProduct.serialNumber || '',
          editedProduct.isKit ? 0 : parseInt(editedProduct.authQuantity) || 1,
          editedProduct.isKit ? 0 : parseInt(editedProduct.ohQuantity) || 1,
          editedProduct.isKit ? editedProduct.liin || '' : '',
          editedProduct.isKit ? editedProduct.endItemNiin || '' : '',
        );

        if (res.success) {
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        } else {
          console.log('Create failed with response:', res);
          setErrorMessage(res.error || 'Failed to create item');
        }
      } else {
        // UPDATE MODE
        const res = await updateItem(teamId, itemId, {
          name: nameValue,
          actualName: editedProduct.actualName || nameValue,
          nsn: editedProduct.isKit
            ? editedProduct.endItemNiin || ''
            : editedProduct.nsn || editedProduct.serialNumber || '',
          serialNumber: editedProduct.isKit
            ? editedProduct.liin || ''
            : editedProduct.serialNumber || '',
          authQuantity: parseInt(editedProduct.authQuantity) || 1,
          ohQuantity: parseInt(editedProduct.ohQuantity) || 1,
          description: editedProduct.description || '',
          imageBase64,
          status: editedProduct.status || 'To Review',
          notes: editedProduct.notes || '',
          parent: editedProduct.parent || null,
          damageReports: damageReports || [],
          liin: editedProduct.liin || '',
          endItemNiin: editedProduct.endItemNiin || '',
        });

        if (res.success) {
          if (product?.status !== editedProduct.status && editedProduct.children?.length > 0) {
            await updateChildrenStatus(editedProduct.children, editedProduct.status);
          }

          if (!isQuickUpdate) setIsEditMode(false);
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        } else {
          setErrorMessage(res.error || 'Failed to update item');
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      // Show the actual error message if available
      const errorMsg = err instanceof Error ? err.message : 'Failed to save item';
      setErrorMessage(errorMsg);
    }
  };

  // Determine if "DONE" button should be shown
  const shouldShowDoneButton = () => {
    if (isCreateMode || isEditMode) return false;

    // Check if status has changed
    const statusChanged = editedProduct?.status && editedProduct.status !== product?.status;

    // Check if notes have changed
    const notesChanged = editedProduct?.notes !== product?.notes;

    // Check if OH Quantity has actually changed (compare as numbers, not strings)
    const ohQuantityChanged = parseInt(editedProduct?.ohQuantity) !== parseInt(product?.ohQuantity);

    // Check if damage reports have changed
    const damageReportsChanged =
      JSON.stringify(damageReports) !== JSON.stringify(product?.damageReports || []);

    // Must have changed status, notes, OH quantity, or damage reports
    if (!statusChanged && !notesChanged && !ohQuantityChanged && !damageReportsChanged)
      return false;

    // If status changed to "Damaged", must have at least one damage report
    if (statusChanged && editedProduct.status === 'Damaged') {
      return damageReports && damageReports.length > 0;
    }

    // If status is already "Damaged" and damage reports changed, must still have at least one
    if (!statusChanged && editedProduct.status === 'Damaged' && damageReportsChanged) {
      return damageReports && damageReports.length > 0;
    }

    // If status changed to "Shortages", validate based on item type
    if (statusChanged && editedProduct.status === 'Shortages') {
      // For kits, just show DONE when status changes to Shortages
      if (editedProduct.isKit) {
        return true;
      }
      // For items, OH Quantity must be less than Authorized Quantity
      const ohQty = parseInt(editedProduct.ohQuantity) || 0;
      const authQty = parseInt(editedProduct.authQuantity) || 0;
      return ohQty < authQty;
    }

    // If status is already "Shortages" and OH Quantity changed (only applies to items)
    if (
      !statusChanged &&
      !editedProduct.isKit &&
      editedProduct.status === 'Shortages' &&
      ohQuantityChanged
    ) {
      const ohQty = parseInt(editedProduct.ohQuantity) || 0;
      const authQty = parseInt(editedProduct.authQuantity) || 0;
      return ohQty < authQty;
    }

    // For status change to "Completed" or "To Review", or just notes change, show DONE
    return true;
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        {(isEditMode || isCreateMode) && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={() => handleSave()}
              size="small"
              sx={{
                fontSize: { xs: isCreateMode ? '0.875rem' : '0.65rem', sm: '0.75rem' },
                px: { xs: isCreateMode ? 3 : 1, sm: 1.5 },
                py: { xs: isCreateMode ? 1.25 : 0.5, sm: 0.75 },
              }}
            >
              {isCreateMode ? 'CREATE' : 'Save'}
            </Button>

            {!isCreateMode && (
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => {
                  setIsEditMode(false);
                  if (setFieldErrors) {
                    setFieldErrors({});
                  }
                }}
                size="small"
                sx={{
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 0.5, sm: 0.75 },
                }}
              >
                Cancel
              </Button>
            )}
          </>
        )}

        {!isEditMode && !isCreateMode && (
          <>
            {shouldShowDoneButton() && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleSave(true)}
                size="small"
                sx={{
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 0.5, sm: 0.75 },
                }}
              >
                DONE
              </Button>
            )}

            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => setIsEditMode(true)}
              size="small"
              sx={{
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                px: { xs: 1, sm: 1.5 },
                py: { xs: 0.5, sm: 0.75 },
              }}
            >
              Edit
            </Button>

            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
              size="small"
              sx={{
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                px: { xs: 1, sm: 1.5 },
                py: { xs: 0.5, sm: 0.75 },
              }}
            >
              Delete
            </Button>
          </>
        )}
      </Stack>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>
          <WarningAmberIcon color="error" sx={{ mr: 1 }} />
          Confirm Deletion
        </DialogTitle>
        <DialogContent dividers>
          <Typography>Are you sure you want to permanently delete this item?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Dialog */}
      <ErrorDialog
        open={!!errorMessage}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
      />
    </>
  );
}
