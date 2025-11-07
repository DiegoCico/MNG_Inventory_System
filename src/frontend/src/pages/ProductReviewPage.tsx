import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import PercentageBar from '../components/PercentageBar';
import { getItem } from '../api/api';

interface ItemViewModel {
  productName: string;
  actualName: string;
  level: string;
  description: string;
  imageLink: string;
  serialNumber: string;
  AuthQuantity: number;
}

interface ProductCardProps {
  product: ItemViewModel;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const [status, setStatus] = React.useState('Found');
  const [notes, setNotes] = React.useState(product.description);

  return (
    <Container
      maxWidth="md"
      sx={{
        px: { xs: 0, sm: 2, md: 3 },
      }}
    >
      <Card>
        <PercentageBar />

        {/* Product Image */}
        <CardMedia
          component="img"
          image={product.imageLink}
          alt={product.productName}
          sx={{
            maxHeight: '40vh',
            objectFit: 'contain',
          }}
        />

        <CardContent>
          {/* Product Title */}
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {product.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {product.actualName}
          </Typography>

          {/* Notes Section */}
          <Box sx={{ mt: 2, mb: 2 }}>
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
              sx={{
                borderRadius: 2,
                '& .MuiInputBase-input': {
                  fontSize: { xs: '0.75rem', sm: '0.9rem', md: '1rem' },
                },
              }}
            />
          </Box>

          {/* Product Details */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Serial Number: {product.serialNumber || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Date Last Scanned: N/A
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last Known Location: N/A
            </Typography>
          </Box>

          {/* Status Dropdown */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Status:
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                sx={{ bgcolor: 'white' }}
              >
                <MenuItem value="Found">Found</MenuItem>
                <MenuItem value="Damaged">Damaged</MenuItem>
                <MenuItem value="Missing">Missing</MenuItem>
                <MenuItem value="In Repair">In Repair</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Complete Button */}
          <Button
            variant="contained"
            fullWidth
            sx={{
              mt: 2,
              bgcolor: '#81c784',
              '&:hover': { bgcolor: '#66bb6a' },
              textTransform: 'none',
              fontWeight: 'bold',
            }}
          >
            Complete
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
};

const ProductDisplay = () => {
  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch item data
        const itemData = await getItem();
        if (itemData) {
          setProduct(itemData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}
      >
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

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
      <ProductCard product={product} />
    </Box>
  );
};

export default ProductDisplay;
