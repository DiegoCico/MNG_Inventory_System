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
}: any) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      alert('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (isQuickUpdate = false) => {
    try {
      // Require image for both items and kits
      if (isCreateMode && !imagePreview) {
        alert('Please add an image before creating the item');
        return;
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
          editedProduct.isKit ? 0 : editedProduct.authQuantity || 1,
          editedProduct.isKit ? 0 : editedProduct.ohQuantity || 1,
          editedProduct.isKit ? editedProduct.liin || '' : '',
          editedProduct.isKit ? editedProduct.endItemNiin || '' : '',
        );

        if (res.success) {
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        } else {
          alert(res.error || 'Failed to create item');
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
          authQuantity: editedProduct.authQuantity || 1,
          ohQuantity: editedProduct.ohQuantity || 1,
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
          alert(res.error || 'Failed to update item');
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save item');
    }
  };

  // Determine if "DONE" button should be shown
  const shouldShowDoneButton = () => {
    if (isCreateMode || isEditMode) return false;

    // Check if status has changed
    const statusChanged = editedProduct?.status && editedProduct.status !== product?.status;

    // Check if notes have changed
    const notesChanged = editedProduct?.notes !== product?.notes;

    // Must have changed either status or notes
    if (!statusChanged && !notesChanged) return false;

    // If status changed to "Damaged", must have at least one damage report
    if (statusChanged && editedProduct.status === 'Damaged') {
      return damageReports && damageReports.length > 0;
    }

    // If status changed to "Shortages", OH Quantity must be less than Authorized Quantity
    if (statusChanged && editedProduct.status === 'Shortages') {
      return (editedProduct.ohQuantity || 0) < (editedProduct.authQuantity || 0);
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
                onClick={() => setIsEditMode(false)}
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
    </>
  );
}
