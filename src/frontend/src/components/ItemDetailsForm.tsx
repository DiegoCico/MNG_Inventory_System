/* eslint-disable */
import React from "react";
import {
  TextField,
  Autocomplete,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  Box,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

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

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {/* ========== Product Name / Item Name ========== */}
      {isEditMode ? (
        <>
          <TextField
            label="Product Name"
            size="small"
            fullWidth
            value={editedProduct.productName || ""}
            onChange={(e) => handleChange("productName", e.target.value)}
            required
          />
          <TextField
            label="Item Name"
            size="small"
            fullWidth
            value={editedProduct.actualName || ""}
            onChange={(e) => handleChange("actualName", e.target.value)}
            required
          />
        </>
      ) : (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Item Name
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {editedProduct.actualName || "-"}
          </Typography>
        </>
      )}

      {/* ========== Serial Number ========== */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {isEditMode ? (
          <TextField
            label="Serial Number (NSN)"
            size="small"
            fullWidth
            value={editedProduct.serialNumber || ""}
            onChange={(e) => handleChange("serialNumber", e.target.value)}
            required
          />
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Serial Number
            </Typography>
            <Typography>{editedProduct.serialNumber || "-"}</Typography>
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

      {/* ========== Quantity ========== */}
      {isEditMode ? (
        <TextField
          label="Quantity"
          type="number"
          size="small"
          fullWidth
          value={editedProduct.quantity || 1}
          onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
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
      {isEditMode ? (
        <TextField
          label="Description"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={editedProduct.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          required
        />
      ) : (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Description
          </Typography>
          <Typography>{editedProduct.description || "No description"}</Typography>
        </Box>
      )}

      {/* ========== Kit From (Parent) ========== */}
      {isEditMode ? (
        <Autocomplete
          options={itemsList}
          getOptionLabel={(option: any) =>
            `${option.name || ""} (${option.actualName || "No name"})`
          }
          value={editedProduct.parent || null}
          onChange={(_e, val) => handleChange("parent", val)}
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
            <Typography>{editedProduct.parent.name || "Unknown Kit"}</Typography>
          </Box>
        )
      )}

      {/* ========== Status (always editable) ========== */}
      {(isEditMode || alwaysEditable("status")) && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
            Status
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={editedProduct.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <MenuItem value="To Review">To Review</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Shortages">Shortages</MenuItem>
              <MenuItem value="Damaged">Damaged</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* ========== Notes  ========== */}
      {(isEditMode || alwaysEditable("notes")) && (
        <TextField
          label="Notes"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={editedProduct.notes || ""}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Add notes..."
        />
      )}
    </Stack>
  );
}
