import React, { useEffect, useState } from 'react';
import {
  Alert,
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
  TextField,
  Typography
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getItem, updateItem, createItem } from '../api/items';
import NavBar from '../components/NavBar';

interface ItemViewModel {
  productName: string; // Generic profile name (e.g., "M4 Carbine")
  actualName: string;  // Specific item name (e.g., "Weapon #5", "Alpha Team Rifle")
  description: string;
  imageLink: string;
  serialNumber: string;
  quantity: number;
  status: string;
}

const PercentageBar = () => <Box sx={{ height: 4, bgcolor: '#e0e0e0', mb: 2 }} />;

const ProductReviewPage = () => {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const isCreateMode = itemId === 'new';

  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [editedProduct, setEditedProduct] = useState<ItemViewModel | null>(null);
  const [notes, setNotes] = useState('');
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState('');
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!teamId) {
        setError('Missing team ID');
        setLoading(false);
        return;
      }

      // If creating new item, set placeholder data
      if (isCreateMode) {
        const placeholderItem: ItemViewModel = {
          productName: '',
          actualName: '',
          description: '',
          imageLink: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800',
          serialNumber: '',
          quantity: 1,
          status: 'Incomplete'
        };
        setProduct(placeholderItem);
        setEditedProduct(placeholderItem);
        setImagePreview(placeholderItem.imageLink);
        setLoading(false);
        return;
      }

      // Otherwise fetch existing item
      if (!itemId) {
        setError('Missing item ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getItem(teamId, itemId);

        if (result.success && result.item) {
          const itemData: ItemViewModel = {
            productName: result.item.name,
            actualName: result.item.actualName || result.item.name, // fallback to name if actualName not set
            description: result.item.description || '',
            imageLink: result.item.imageLink || '',
            serialNumber: result.item.serialNumber || '',
            quantity: result.item.quantity || 1,
            status: result.item.status || 'Found'
          };
          setProduct(itemData);
          setEditedProduct(itemData);
          setNotes(itemData.description);
          setImagePreview(itemData.imageLink);
        } else {
          setError(result.error || 'Item not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, itemId, isCreateMode]);

  const handleFieldChange = (field: keyof ItemViewModel, value: string | number) => {
    if (editedProduct) {
      setEditedProduct({ ...editedProduct, [field]: value });
    }
  };

  const handleAddDamageReport = () => {
    if (currentDamageReport.trim()) {
      setDamageReports(prev => [...prev, currentDamageReport.trim()]);
      setCurrentDamageReport('');
    }
  };

  const handleRemoveDamageReport = (index: number) => {
    setDamageReports(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      setSelectedImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file: File): Promise<string> => {
    // TODO: Implement S3 upload logic
    console.log('Uploading file to S3:', file.name);
    return 'https://example-bucket.s3.amazonaws.com/' + file.name;
  };

  const handleSave = async () => {
    if (!teamId || !editedProduct) {
      alert('Missing required data');
      return;
    }

    if (editedProduct.status === 'Damaged' && damageReports.length === 0) {
      setShowError(true);
      return;
    }

    // Validate required fields for new items
    if (isCreateMode && !editedProduct.productName.trim()) {
      alert('Product name is required');
      return;
    }

    let finalImageUrl = editedProduct.imageLink;
    if (selectedImageFile) {
      try {
        finalImageUrl = await uploadImageToS3(selectedImageFile);
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image. Please try again.');
        return;
      }
    }

    try {
      if (isCreateMode) {
        // Create new item
        const result = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          '', // nsn
          editedProduct.serialNumber,
          'user-id-placeholder' // TODO: Get actual user ID from auth context
        );

        if (result.success) {
          console.log('Item created successfully:', result.item);
          setShowSuccess(true);
          // Redirect to the new item's page and replace history so back button works correctly
          setTimeout(() => {
            navigate(`/teams/${teamId}/items/${result.itemId}`, { replace: true });
          }, 1500);
        } else {
          alert('Failed to create item: ' + result.error);
        }
      } else {
        // Update existing item (works in both edit and view mode now)
        if (!itemId) {
          alert('Missing item ID');
          return;
        }

        const result = await updateItem(teamId, itemId, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: notes, // Save the notes field
          imageLink: finalImageUrl,
          status: editedProduct.status
        });

        if (result.success) {
          console.log('Item updated successfully:', result.item);
          // Update local state with saved notes
          const updatedProduct = { ...editedProduct, description: notes };
          setProduct(updatedProduct);
          setEditedProduct(updatedProduct);
          setIsEditMode(false);
          setSelectedImageFile(null);
          setShowSuccess(true);
        } else {
          alert('Failed to update item: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  const handleCancel = () => {
    if (product) {
      setEditedProduct(product);
      setNotes(product.description);
      setSelectedImageFile(null);
      setImagePreview(product.imageLink);
      setIsEditMode(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!product || !editedProduct) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );
  }

  return (
    <div>
      <PercentageBar />
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2, md: 3 }, pb: 10 }}>
        {/* Back Button */}
        <Box sx={{ mb: 2, pt: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Back
          </Button>
        </Box>

        <Card sx={{ '&:hover': { transform: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } }}>
          {/* Product Image */}
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              image={imagePreview}
              alt={editedProduct.productName}
              sx={{ maxHeight: '45vh', objectFit: 'contain', bgcolor: '#f5f5f5' }}
            />
            {isEditMode && (
              <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 1 }}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload-button"
                  type="file"
                  onChange={handleImageChange}
                />
                <label htmlFor="image-upload-button">
                  <Button
                    variant="contained"
                    component="span"
                    size="small"
                    startIcon={<EditIcon />}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.95)',
                      color: 'primary.main',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 1)' },
                      textTransform: 'none',
                      boxShadow: 2
                    }}
                  >
                    Change Image
                  </Button>
                </label>
              </Box>
            )}
          </Box>

          <CardContent>
            {/* Edit Mode Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" fontWeight="bold">
                {isCreateMode ? 'Create New Item' : editedProduct.productName}
              </Typography>
              {!isCreateMode && !isEditMode ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                  sx={{ textTransform: 'none', color: 'primary.main', borderColor: 'primary.main' }}
                >
                  Edit
                </Button>
              ) : !isCreateMode && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancel}
                  sx={{ textTransform: 'none', color: 'error.main', borderColor: 'error.main' }}
                >
                  Cancel
                </Button>
              )}
            </Box>

            {/* Product Name - Only editable in edit mode */}
            {isEditMode ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Product Name:
                </Typography>
                <TextField
                  fullWidth
                  value={editedProduct.productName}
                  onChange={(e) => handleFieldChange('productName', e.target.value)}
                  size="small"
                  placeholder="e.g., M4 Carbine"
                />
              </Box>
            ) : null}

            {/* Actual Name */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Item Name:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  value={editedProduct.actualName}
                  onChange={(e) => handleFieldChange('actualName', e.target.value)}
                  size="small"
                  placeholder="e.g., Alpha Team Rifle #1"
                />
              ) : (
                <Typography variant="body1" color="text.secondary">
                  {editedProduct.actualName || 'N/A'}
                </Typography>
              )}
            </Box>

            {/* Description - Only shown in edit mode */}
            {isEditMode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Description:
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={editedProduct.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  size="small"
                />
              </Box>
            )}

            {/* Selected Image File Indicator */}
            {isEditMode && selectedImageFile && (
              <Box sx={{ mb: 2, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                <Typography variant="body2" color="primary">
                  New image selected: {selectedImageFile.name}
                </Typography>
              </Box>
            )}

            {/* Serial Number */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Serial Number:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  value={editedProduct.serialNumber}
                  onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {editedProduct.serialNumber || 'N/A'}
                </Typography>
              )}
            </Box>

            {/* Quantity */}
            {isEditMode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Quantity:
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={editedProduct.quantity}
                  onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 0)}
                  size="small"
                />
              </Box>
            )}

            {/* Notes Section */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Notes:
              </Typography>
              <TextField
                multiline
                fullWidth
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes here..."
                sx={{ borderRadius: 2 }}
              />
            </Box>

            {/* Status Dropdown - Only for existing items */}
            {!isCreateMode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Status:
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={editedProduct.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    sx={{ bgcolor: 'white' }}
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

            {/* Damage Reports Section */}
            {editedProduct.status === 'Damaged' && (
              <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Damage Reports:
                </Typography>

                <Box sx={{ mb: 2 }}>
                  {damageReports.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No damage reports added yet
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {damageReports.map((report, index) => (
                        <Chip
                          key={index}
                          label={report}
                          onDelete={() => handleRemoveDamageReport(index)}
                          deleteIcon={<DeleteIcon />}
                          sx={{ width: '100%', justifyContent: 'space-between' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={currentDamageReport}
                    onChange={(e) => setCurrentDamageReport(e.target.value)}
                    placeholder="Describe damage..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDamageReport();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddDamageReport}
                    sx={{ textTransform: 'none', minWidth: 'auto', px: 2 }}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            )}

            {/* Save Button - Always visible */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSave}
              sx={{
                mt: 2,
                bgcolor: '#6ec972',
                '&:hover': { bgcolor: '#39c03f' },
                textTransform: 'none',
                fontWeight: 'bold'
              }}
            >
              {isCreateMode ? 'Create Item' : isEditMode ? 'Save Changes' : 'Save Notes'}
            </Button>
          </CardContent>
        </Card>

        {/* Error Snackbar */}
        <Snackbar
          open={showError}
          autoHideDuration={4000}
          onClose={() => setShowError(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setShowError(false)} severity="error" sx={{ width: '100%' }}>
            Please add at least one damage report before saving
          </Alert>
        </Snackbar>

        {/* Success Snackbar */}
        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: '100%' }}>
            Item updated successfully!
          </Alert>
        </Snackbar>
      </Container>
      <NavBar />
    </div>
  );
};

export default ProductReviewPage;

