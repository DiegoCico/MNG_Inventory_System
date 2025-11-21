/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { createItem, deleteItem, updateItem } from '../api/items';
import { me } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

async function getUserId(): Promise<string> {
  try {
    const user = await me();
    return user.userId;
  } catch {
    return 'test-user';
  }
}

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
  const theme = useTheme();
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
      if (isCreateMode && !imagePreview) {
        alert('Please add an image before creating the item');
        return;
      }

      const userId = await getUserId();

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
        const res = await createItem(
          teamId,
          nameValue,
          editedProduct.actualName || nameValue,
          editedProduct.nsn || editedProduct.serialNumber || '',
          editedProduct.serialNumber || '',
          imageBase64, // ← CLEAN FIX
          editedProduct.description || '',
          editedProduct.parent?.itemId || null,
        );

        if (res.success) {
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        }
      } else {
        // UPDATE MODE
        const res = await updateItem(teamId, itemId, {
          name: nameValue,
          actualName: editedProduct.actualName || nameValue,
          nsn: editedProduct.nsn || editedProduct.serialNumber || '',
          serialNumber: editedProduct.serialNumber || '',
          quantity: Number(editedProduct.quantity) || 1,
          description: editedProduct.description || '',
          imageBase64, // ← CLEAN FIX
          status: editedProduct.status || 'To Review',
          notes: editedProduct.notes || '',
          parent: editedProduct.parent?.itemId || null,
          damageReports: damageReports || [],
        });

        if (res.success) {
          if (product?.status !== editedProduct.status && editedProduct.children?.length > 0) {
            await updateChildrenStatus(editedProduct.children, editedProduct.status);
          }

          if (!isQuickUpdate) setIsEditMode(false);
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save item');
    }
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          position: 'sticky',
          top: 16,
          borderRadius: 3,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 2px 10px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(0,0,0,0.05)',
          bgcolor: theme.palette.background.paper,
        }}
      >
        <CardHeader title="Actions" />
        <CardContent>
          {/* Buttons */}
          <Stack spacing={1}>
            {(isEditMode || isCreateMode) && (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave()}
                >
                  {isCreateMode ? 'Create Item' : 'Save Changes'}
                </Button>

                {!isCreateMode && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => setIsEditMode(false)}
                  >
                    Cancel
                  </Button>
                )}
              </>
            )}

            {!isEditMode && !isCreateMode && (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave(true)}
                >
                  Save
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                >
                  Edit
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

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
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
