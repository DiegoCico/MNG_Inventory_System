/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Button, Card, CardHeader, CardContent, Stack } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { createItem, updateItem, uploadImage, deleteItem } from "../api/items";
import { me } from "../api/auth";

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
}: any) {
  const handleSave = async (isQuickUpdate = false) => {
    try {
      const currentUser = await me();
      if (!currentUser?.userId) {
        alert("User not authenticated");
        return;
      }

      let finalImage = imagePreview;
      if (selectedImageFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res) => {
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(selectedImageFile);
        });
        const up = await uploadImage(teamId, editedProduct.serialNumber, base64);
        finalImage = up.imageLink;
      }

      const nameValue =
        editedProduct.productName ||
        editedProduct.actualName ||
        `Item-${editedProduct.serialNumber || "Unknown"}`;

      const payload = {
        teamId,
        itemId: itemId || null,
        userId: currentUser.userId,
        name: nameValue,
        actualName: editedProduct.actualName || nameValue,
        nsn: editedProduct.nsn || editedProduct.serialNumber || "",
        serialNumber: editedProduct.serialNumber || "",
        quantity: Number(editedProduct.quantity) || 1,
        description: editedProduct.description || "",
        imageLink: finalImage || "",
        status: editedProduct.status || "Incomplete",
        notes: editedProduct.notes || "",
        parent: editedProduct.parent?.itemId || null,
        damageReports: editedProduct.damageReports || [],
      };

      console.log("[handleSave] final payload:", payload);

      if (isCreateMode) {
        const res = await createItem(
          teamId,
          payload.name,
          payload.actualName,
          payload.nsn,
          payload.serialNumber,
          currentUser.userId,
          finalImage
        );
        if (res.success) setShowSuccess(true);
      } else {
        const res = await updateItem(teamId, itemId, payload);
        if (res.success) {
          if (!isQuickUpdate) setIsEditMode(false);
          setShowSuccess(true);
        }
      }
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("Failed to save item");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this item?")) return;
    await deleteItem(teamId, itemId);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        position: "sticky",
        top: 16,
        borderRadius: 3,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <CardHeader title="Actions" />
      <CardContent>
        <Stack spacing={1}>
          {(isEditMode || isCreateMode) && (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => handleSave()}
                sx={{
                  bgcolor: "#2e7d32",
                  "&:hover": { bgcolor: "#1b5e20" },
                  fontWeight: 600,
                }}
              >
                {isCreateMode ? "Create Item" : "Save Changes"}
              </Button>
              {!isCreateMode && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => setIsEditMode(false)}
                  sx={{
                    color: "#ef6c00",
                    borderColor: "#ef6c00",
                    "&:hover": { bgcolor: "#fff3e0" },
                  }}
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
                sx={{
                  fontWeight: 600,
                  bgcolor: "#2e7d32",
                  "&:hover": { bgcolor: "#1b5e20" },
                }}
              >
                Save
              </Button>

              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setIsEditMode(true)}
                sx={{
                  bgcolor: "#1565c0",
                  "&:hover": { bgcolor: "#0d47a1" },
                  fontWeight: 600,
                }}
              >
                Edit
              </Button>

              <Button
                fullWidth
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                sx={{
                  bgcolor: "#d32f2f",
                  "&:hover": { bgcolor: "#b71c1c" },
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
