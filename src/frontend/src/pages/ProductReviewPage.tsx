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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useParams, useNavigate } from "react-router-dom";
import { getItem, getItems, createItem, updateItem, uploadImage } from "../api/items";
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

const ProductReviewPage: React.FC = () => {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const isCreateMode = itemId === "new";

  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [editedProduct, setEditedProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState("");
  const [notes, setNotes] = useState("");
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  // ===================== FETCH ITEM & LIST =====================
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!teamId) throw new Error("Missing team ID");

        const all = await getItems(teamId);
        if (all.success && all.items) {
          const flatten = (arr: any[]): any[] =>
            arr.flatMap((i) => [i, ...(i.children ? flatten(i.children) : [])]);
          const flat = flatten(all.items);
          const filtered = flat.filter((x: any) => x.itemId !== itemId);
          setItemsList(filtered);
        }

        if (isCreateMode) {
          const placeholder: ItemViewModel = {
            productName: "",
            actualName: "",
            description: "",
            imageLink:
              "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800",
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

        const result = await getItem(teamId, itemId!);
        if (!result.success || !result.item) throw new Error(result.error || "Item not found");
        const i = result.item;
        const mapped: ItemViewModel = {
          productName: i.name,
          actualName: i.actualName || i.name,
          description: i.description || "",
          imageLink: i.imageLink || "",
          serialNumber: i.serialNumber || "",
          quantity: i.quantity || 1,
          status: i.status || "Incomplete",
          parent: i.parent || null,
          children: i.children || [],
        };
        setProduct(mapped);
        setEditedProduct(mapped);
        setImagePreview(mapped.imageLink);
        setNotes(mapped.description);
      } catch (err: any) {
        setError(err.message || "Failed to load item");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, itemId, isCreateMode]);

  // ===================== FIELD HANDLERS =====================
  const handleFieldChange = (field: keyof ItemViewModel, value: any) => {
    if (editedProduct) {
      setEditedProduct({ ...editedProduct, [field]: value });
      setFieldErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddDamageReport = () => {
    if (currentDamageReport.trim()) {
      setDamageReports([...damageReports, currentDamageReport.trim()]);
      setCurrentDamageReport("");
    }
  };

  const handleRemoveDamageReport = (idx: number) => {
    setDamageReports((prev) => prev.filter((_, i) => i !== idx));
  };

  // ===================== UPLOAD IMAGE =====================
  const uploadImageToS3 = async (file: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const nsn =
            editedProduct?.serialNumber ||
            Math.random().toString(36).substring(2, 10);
          const res = await uploadImage(teamId!, nsn, base64);
          if (!res.success || !res.imageLink)
            throw new Error(res.error || "Upload failed");
          resolve(res.imageLink);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // ===================== SAVE ITEM =====================
  const handleSave = async () => {
    if (!teamId || !editedProduct) return;
    const required: (keyof ItemViewModel)[] = [
      "productName",
      "actualName",
      "serialNumber",
      "description",
    ];
    const missing = required.filter((f) => !editedProduct[f]);
    if (missing.length) {
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
      let finalImage = editedProduct.imageLink;
      if (selectedImageFile)
        finalImage = await uploadImageToS3(selectedImageFile);

      if (isCreateMode) {
        const result = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          editedProduct.serialNumber,
          editedProduct.serialNumber,
          undefined,
          finalImage
        );
        if (result.success && result.item) {
          setShowSuccess(true);
          setTimeout(() => {
            navigate(`/teams/${teamId}/items/${result.item.itemId}`, {
              replace: true,
            });
          }, 1200);
        } else throw new Error(result.error || "Failed to create item");
      } else {
        const result = await updateItem(teamId, itemId!, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          nsn: editedProduct.serialNumber,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: editedProduct.description,
          imageLink: finalImage,
          status: editedProduct.status,
          parent: editedProduct.parent?.itemId || null,
          damageReports,
        });
        if (result.success) {
          setProduct(editedProduct);
          setIsEditMode(false);
          setShowSuccess(true);
        } else throw new Error(result.error || "Update failed");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save item.");
    }
  };

  // ===================== CHILDREN RENDER =====================
  const renderChildren = (children: any[], level = 0): React.ReactNode => {
    if (!children || children.length === 0) return null;
    return (
      <Stack spacing={1} sx={{ ml: level * 2 }}>
        {children.map((child: any) => (
          <Box key={child.itemId}>
            <Card
              onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
              sx={{
                p: 1.5,
                cursor: "pointer",
                bgcolor:
                  level === 0
                    ? "white"
                    : `rgba(25, 118, 210, ${0.05 * (level + 1)})`,
                "&:hover": { bgcolor: "#e3f2fd" },
                borderLeft:
                  level > 0
                    ? `3px solid rgba(25, 118, 210, ${
                        0.3 + level * 0.2
                      })`
                    : "none",
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {"  ".repeat(level)}├─ {child.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {"  ".repeat(level)} {child.actualName || child.name}
              </Typography>
              {child.status && (
                <Chip
                  label={child.status}
                  size="small"
                  sx={{ ml: 1, mt: 0.5 }}
                  color={
                    child.status === "Found"
                      ? "success"
                      : child.status === "Damaged"
                      ? "error"
                      : child.status === "Missing"
                      ? "warning"
                      : "default"
                  }
                />
              )}
            </Card>
            {child.children &&
              child.children.length > 0 &&
              renderChildren(child.children, level + 1)}
          </Box>
        ))}
      </Stack>
    );
  };

  // ===================== RENDER BODY =====================
  if (loading)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
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

  // ==============================================================
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
                  <Button
                    component="span"
                    variant="contained"
                    size="small"
                    startIcon={<EditIcon />}
                  >
                    Change Image
                  </Button>
                </label>
              </Box>
            )}
          </Box>

          <CardContent>
            {/* ===== HEADER ===== */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h5" fontWeight="bold">
                {isCreateMode ? "Create New Item" : editedProduct.productName}
              </Typography>
              {!isCreateMode &&
                (isEditMode ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditedProduct(product);
                      setIsEditMode(false);
                    }}
                    sx={{
                      textTransform: "none",
                      color: "error.main",
                      borderColor: "error.main",
                      bgcolor: "#fff8e1",
                      "&:hover": { bgcolor: "#ffecb3" },
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditMode(true)}
                    sx={{
                      textTransform: "none",
                      color: "primary.main",
                      borderColor: "primary.main",
                    }}
                  >
                    Edit
                  </Button>
                ))}
            </Box>

            {/* ===== EDIT / VIEW ===== */}
            {isEditMode || isCreateMode ? (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Product Name"
                  value={editedProduct.productName}
                  onChange={(e) => handleFieldChange("productName", e.target.value)}
                  sx={{ mb: 2 }}
                  error={fieldErrors.productName}
                  helperText={fieldErrors.productName ? "Required" : ""}
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
                  helperText={fieldErrors.actualName ? "Required" : ""}
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
                  helperText={fieldErrors.serialNumber ? "Required" : ""}
                  required
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Quantity"
                  type="number"
                  value={editedProduct.quantity}
                  onChange={(e) =>
                    handleFieldChange("quantity", parseInt(e.target.value) || 0)
                  }
                  sx={{ mb: 2 }}
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
                  helperText={fieldErrors.description ? "Required" : ""}
                  required
                />
                <Autocomplete
                  options={itemsList}
                  getOptionLabel={(option: any) =>
                    `${option.name} (${option.actualName || "No name"})`
                  }
                  value={editedProduct.parent || null}
                  onChange={(_e, val) => handleFieldChange("parent", val)}
                  isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Kit From"
                      placeholder="Select parent item"
                    />
                  )}
                  sx={{ mb: 2 }}
                />
              </>
            ) : (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Item Name
                  </Typography>
                  <Typography variant="body1">{editedProduct.actualName}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Serial Number
                  </Typography>
                  <Typography variant="body1">{editedProduct.serialNumber || "N/A"}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography variant="body1">{editedProduct.quantity}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {editedProduct.description || "No description"}
                  </Typography>
                </Box>
                {editedProduct.parent && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                      Part of Kit
                    </Typography>
                    <Typography variant="body1">
                      {editedProduct.parent.name || "Unknown Kit"}
                    </Typography>
                  </Box>
                )}
              </>
            )}

            {/* ===== NOTES ===== */}
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

            {/* ===== STATUS ===== */}
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

            {/* ===== DAMAGE REPORTS ===== */}
            {editedProduct.status === "Damaged" && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#fff3e0", borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Damage Reports
                </Typography>
                {damageReports.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    No damage reports added yet
                  </Typography>
                ) : (
                  damageReports.map((r, i) => (
                    <Chip
                      key={i}
                      label={r}
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

            {/* ===== CHILDREN ===== */}
            {!isCreateMode &&
              editedProduct.children &&
              editedProduct.children.length > 0 && (
                <Box sx={{ mb: 2, p: 2, bgcolor: "#f0f7ff", borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    📦 Kit Contents ({editedProduct.children.length} items)
                  </Typography>
                  {renderChildren(editedProduct.children, 0)}
                </Box>
              )}

            {/* ===== SAVE BUTTON ===== */}
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

        {/* ===== SNACKBARS ===== */}
        <Snackbar
          open={showError}
          autoHideDuration={4000}
          onClose={() => setShowError(false)}
        >
          <Alert severity="error">Add at least one damage report</Alert>
        </Snackbar>

        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSuccess(false)}
        >
          <Alert severity="success">Item updated successfully!</Alert>
        </Snackbar>
      </Container>
      <NavBar />
    </div>
  );
};

export default ProductReviewPage;
