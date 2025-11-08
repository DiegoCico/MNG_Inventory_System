/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getItem, updateItem, createItem, uploadImage, getItems } from "../api/items";
import NavBar from "../components/NavBar";

interface ItemViewModel {
  productName: string;
  actualName: string;
  description: string;
  imageLink: string;
  serialNumber: string;
  quantity: number;
  status: string;
  parent?: any;
  children?: any[];
}

const PercentageBar = () => <Box sx={{ height: 4, bgcolor: "#e0e0e0", mb: 2 }} />;

const ProductReviewPage = () => {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const isCreateMode = itemId === "new";

  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [editedProduct, setEditedProduct] = useState<ItemViewModel | null>(null);
  const [notes, setNotes] = useState("");
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState("");
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!teamId) {
        setError("Missing team ID");
        setLoading(false);
        return;
      }

      try {
        const all = await getItems(teamId);
        if (all.success && all.items) {
          // Flatten the nested structure and exclude current item
          const flattenItems = (items: any[]): any[] => {
            return items.reduce((acc, item) => {
              acc.push(item);
              if (item.children && item.children.length > 0) {
                acc.push(...flattenItems(item.children));
              }
              return acc;
            }, []);
          };

          const allFlat = flattenItems(all.items);
          // Filter out the current item from the list
          const filtered = allFlat.filter((i: any) => i.itemId !== itemId);
          setItemsList(filtered);
        }
      } catch {
        console.warn("⚠️ Could not load items for Kit From");
      }

      if (isCreateMode) {
        const placeholder: ItemViewModel = {
          productName: "",
          actualName: "",
          description: "",
          imageLink: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800",
          serialNumber: "",
          quantity: 1,
          status: "Incomplete",
        };
        setProduct(placeholder);
        setEditedProduct(placeholder);
        setImagePreview(placeholder.imageLink);
        setLoading(false);
        return;
      }

      if (!itemId) {
        setError("Missing item ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await getItem(teamId, itemId);
        if (result.success && result.item) {
          const itemData: ItemViewModel = {
            productName: result.item.name,
            actualName: result.item.actualName || result.item.name,
            description: result.item.description || "",
            imageLink: result.item.imageLink || "",
            serialNumber: result.item.serialNumber || "",
            quantity: result.item.quantity || 1,
            status: result.item.status || "Found",
            parent: result.item.parent || null,
            children: result.item.children || [],
          };
          setProduct(itemData);
          setEditedProduct(itemData);
          setNotes(itemData.description);
          setImagePreview(itemData.imageLink);
        } else setError(result.error || "Item not found");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, itemId, isCreateMode]);

  const handleFieldChange = (field: keyof ItemViewModel, value: string | number | null) => {
    if (editedProduct) {
      setEditedProduct({ ...editedProduct, [field]: value });
      setFieldErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleAddDamageReport = () => {
    if (currentDamageReport.trim()) {
      setDamageReports((prev) => [...prev, currentDamageReport.trim()]);
      setCurrentDamageReport("");
    }
  };

  const handleRemoveDamageReport = (index: number) => {
    setDamageReports((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const nsn =
            editedProduct?.serialNumber ||
            crypto.randomUUID?.() ||
            Math.random().toString(36).substring(2, 12);
          const res = await uploadImage(teamId!, nsn, base64Data);
          if (!res.success) throw new Error(res.error || "Upload failed");
          resolve(res.imageLink);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!teamId || !editedProduct) return;

    const requiredFields: (keyof ItemViewModel)[] = [
      "productName",
      "actualName",
      "serialNumber",
      "quantity",
      "description",
    ];

    const missing = requiredFields.filter((f) => !editedProduct[f]);
    if (missing.length > 0) {
      const errs: Record<string, boolean> = {};
      missing.forEach((f) => (errs[f] = true));
      setFieldErrors(errs);
      return;
    }

    if (editedProduct.status === "Damaged" && damageReports.length === 0) {
      setShowError(true);
      return;
    }

    try {
      const userId = 'test-user'; // Use test user since auth is disabled

      let finalImageUrl = editedProduct.imageLink;
      if (selectedImageFile) finalImageUrl = await uploadImageToS3(selectedImageFile);

      if (isCreateMode) {
        const result = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          editedProduct.serialNumber,
          editedProduct.serialNumber,
          userId,
          finalImageUrl,
          editedProduct.description,
          editedProduct.parent?.itemId || null
        );
        if (result.success) {
          setShowSuccess(true);
          setTimeout(
            () => navigate(`/teams/${teamId}/items/${result.itemId}`, { replace: true }),
            1500
          );
        } else alert("Create failed: " + result.error);
      } else {
        const result = await updateItem(teamId, itemId!, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          nsn: editedProduct.serialNumber,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: editedProduct.description,
          imageLink: finalImageUrl,
          status: editedProduct.status,
          damageReports,
          parent: editedProduct.parent?.itemId || null,
        } as any);
        if (result.success) {
          setProduct({ ...editedProduct, description: notes });
          setIsEditMode(false);
          setShowSuccess(true);
        } else alert("Update failed: " + result.error);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert("Failed to save item.");
    }
  };

  const renderChildren = (children: any[], level = 0) => {
    if (!children || children.length === 0) return null;

    return (
      <Stack spacing={1} sx={{ ml: level * 2 }}>
        {children.map((child: any) => (
          <Box key={child.itemId}>
            <Card
              onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
              sx={{
                p: 1.5,
                cursor: 'pointer',
                bgcolor: level === 0 ? 'white' : `rgba(0, 0, 0, ${0.02 * (level + 1)})`,
                '&:hover': { bgcolor: '#f5f5f5' },
                borderLeft: level > 0 ? '3px solid #1976d2' : 'none',
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {'  '.repeat(level)}├─ {child.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {'  '.repeat(level)}   {child.actualName || child.name}
              </Typography>
              {child.status && (
                <Chip
                  label={child.status}
                  size="small"
                  sx={{ ml: level * 2, mt: 0.5 }}
                />
              )}
            </Card>
            {child.children && child.children.length > 0 && renderChildren(child.children, level + 1)}
          </Box>
        ))}
      </Stack>
    );
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );

  if (!product || !editedProduct)
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );

  return (
    <div>
      <PercentageBar />
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2, md: 3 }, pb: 10 }}>
        <Box sx={{ mb: 2, pt: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              textTransform: "none",
              color: "text.secondary",
              "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
            }}
          >
            Back
          </Button>
        </Box>

        <Card>
          <Box sx={{ position: "relative" }}>
            <CardMedia
              component="img"
              image={imagePreview}
              alt={editedProduct.productName}
              sx={{ maxHeight: "45vh", objectFit: "contain", bgcolor: "#f5f5f5" }}
            />
            {isEditMode && (
              <Box sx={{ position: "absolute", bottom: 8, right: 8 }}>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageChange}
                />
                <label htmlFor="image-upload">
                  <Button component="span" variant="contained" size="small" startIcon={<EditIcon />}>
                    Change Image
                  </Button>
                </label>
              </Box>
            )}
          </Box>

          <CardContent>
            {/* Header with Edit/Cancel button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" fontWeight="bold">
                {isCreateMode ? 'Create New Item' : editedProduct.productName}
              </Typography>
              {!isCreateMode && (
                isEditMode ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditedProduct(product);
                      setIsEditMode(false);
                    }}
                    sx={{ textTransform: 'none', color: 'error.main', borderColor: 'error.main' }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditMode(true)}
                    sx={{ textTransform: 'none', color: 'primary.main', borderColor: 'primary.main' }}
                  >
                    Edit
                  </Button>
                )
              )}
            </Box>

            {/* Show fields based on edit mode */}
            {isEditMode || isCreateMode ? (
              // Edit mode - show all editable fields
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Product Name"
                  value={editedProduct.productName}
                  onChange={(e) => handleFieldChange("productName", e.target.value)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.productName}
                  helperText={fieldErrors.productName ? "Please input it" : ""}
                  required
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Item Name"
                  value={editedProduct.actualName}
                  onChange={(e) => handleFieldChange("actualName", e.target.value)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.actualName}
                  helperText={fieldErrors.actualName ? "Please input it" : ""}
                  required
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Serial Number"
                  value={editedProduct.serialNumber}
                  onChange={(e) => handleFieldChange("serialNumber", e.target.value)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.serialNumber}
                  helperText={fieldErrors.serialNumber ? "Please input it" : ""}
                  required
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Quantity"
                  type="number"
                  value={editedProduct.quantity}
                  onChange={(e) => handleFieldChange("quantity", parseInt(e.target.value) || 0)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.quantity}
                  helperText={fieldErrors.quantity ? "Please input it" : ""}
                  required
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={editedProduct.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.description}
                  helperText={fieldErrors.description ? "Please input it" : ""}
                  required
                />

                <Autocomplete
                  options={itemsList}
                  getOptionLabel={(option: any) => `${option.name} (${option.actualName || 'No name'})`}
                  value={editedProduct.parent || null}
                  onChange={(_e, val) => handleFieldChange("parent", val)}
                  isOptionEqualToValue={(option, value) => option.itemId === value?.itemId}
                  renderInput={(params) => <TextField {...params} label="Kit From" placeholder="Select parent item" />}
                  sx={{ mb: 2 }}
                />
              </>
            ) : (
              // View mode - show read-only fields
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Item Name
                  </Typography>
                  <Typography variant="body1">
                    {editedProduct.actualName}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Serial Number
                  </Typography>
                  <Typography variant="body1">
                    {editedProduct.serialNumber || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography variant="body1">
                    {editedProduct.quantity}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {editedProduct.description || 'No description'}
                  </Typography>
                </Box>

                {editedProduct.parent && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                      Part of Kit
                    </Typography>
                    <Typography variant="body1">
                      {editedProduct.parent.name || 'Unknown Kit'}
                    </Typography>
                  </Box>
                )}
              </>
            )}

            {/* Notes - always editable */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="Optional notes..."
            />

            {/* Status dropdown */}
            {!isCreateMode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Status
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={editedProduct.status}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                  >
                    <MenuItem value="Incomplete">Incomplete</MenuItem>
                    <MenuItem value="Found">Found</MenuItem>
                    <MenuItem value="Damaged">Damaged</MenuItem>
                    <MenuItem value="Missing">Missing</MenuItem>
                    <MenuItem value="In Repair">In Repair</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {editedProduct.status === "Damaged" && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#fff3e0", borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Damage Reports
                </Typography>
                {damageReports.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    No damage reports added yet
                  </Typography>
                ) : (
                  damageReports.map((report, i) => (
                    <Chip
                      key={i}
                      label={report}
                      onDelete={() => handleRemoveDamageReport(i)}
                      deleteIcon={<DeleteIcon />}
                      sx={{ m: 0.5 }}
                    />
                  ))
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={currentDamageReport}
                    onChange={(e) => setCurrentDamageReport(e.target.value)}
                    placeholder="Describe damage..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDamageReport();
                      }
                    }}
                  />
                  <Button variant="outlined" onClick={handleAddDamageReport}>
                    Add
                  </Button>
                </Box>
              </Box>
            )}

            {/* Kit Contents - Show children recursively */}
            {!isCreateMode && editedProduct.children && editedProduct.children.length > 0 && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#f0f7ff", borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  📦 Kit Contents ({editedProduct.children.length} items)
                </Typography>
                {renderChildren(editedProduct.children, 0)}
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 2, bgcolor: "#6ec972", "&:hover": { bgcolor: "#39c03f" } }}
              onClick={handleSave}
            >
              {isCreateMode ? "Create Item" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Snackbar open={showError} autoHideDuration={4000} onClose={() => setShowError(false)}>
          <Alert severity="error">Add at least one damage report</Alert>
        </Snackbar>

        <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
          <Alert severity="success">Item updated successfully!</Alert>
        </Snackbar>
      </Container>
      <NavBar />
    </div>
  );
};

const renderChildren = (children: any[], level = 0): React.ReactNode => {
  if (!children || children.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ ml: level * 2 }}>
      {children.map((child: any) => (
        <Box key={child.itemId}>
          <Card
            sx={{
              p: 1.5,
              cursor: 'pointer',
              bgcolor: level === 0 ? 'white' : `rgba(25, 118, 210, ${0.05 * (level + 1)})`,
              '&:hover': { bgcolor: '#e3f2fd' },
              borderLeft: level > 0 ? `3px solid rgba(25, 118, 210, ${0.3 + level * 0.2})` : 'none',
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {'  '.repeat(level)}├─ {child.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {'  '.repeat(level)}   {child.actualName || child.name}
            </Typography>
            {child.status && (
              <Chip
                label={child.status}
                size="small"
                sx={{ ml: 1, mt: 0.5 }}
                color={
                  child.status === 'Found' ? 'success' :
                    child.status === 'Damaged' ? 'error' :
                      child.status === 'Missing' ? 'warning' :
                        'default'
                }
              />
            )}
          </Card>
          {child.children && child.children.length > 0 && renderChildren(child.children, level + 1)}
        </Box>
      ))}
    </Stack>
  );
};

export default ProductReviewPage;
