import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import PercentageBar from '../components/PercentageBar';
import { getItem } from '../api/api';
import NavBar from '../components/NavBar';

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

const FAKE_ITEM: ItemViewModel = {
  productName: "M4 Carbine Rifle",
  actualName: "5.56mm Rifle, M4A1",
  level: "Sensitive",
  description: "Standard issue carbine rifle for infantry units. Regular maintenance required.",
  imageLink: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800",
  serialNumber: "W123456789",
  AuthQuantity: 1
};

const ProductCard = ({ product }: ProductCardProps) => {
  const [status, setStatus] = React.useState('Found');
  const [notes, setNotes] = React.useState(product.description);

  return (
    <div>
      <PercentageBar />
      <Container maxWidth="md" sx={{
        px: { xs: 0, sm: 2, md: 3 },
        pb: 10,
      }}>
        <Card sx={{
          '&:hover': {
            transform: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }
        }}>
          {/* Product Image */}
          <CardMedia
            component="img"
            image={product.imageLink}
            alt={product.productName}
            sx={{
              maxHeight: '45vh',
              objectFit: 'contain'
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
                    fontSize: { xs: '0.75rem', sm: '0.9rem', md: '1rem' }
                  }
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
                bgcolor: '#6ec972',
                '&:hover': { bgcolor: '#39c03f' },
                textTransform: 'none',
                fontWeight: 'bold'
              }}
            >

              Save
            </Button>
          </CardContent>
        </Card>
      </Container>
      <NavBar />
    </div>
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

        setProduct(FAKE_ITEM);

        // Fetch item data (TODO comment back in when api works!)
        // const itemData = await getItem();
        // if (itemData) {
        //   setProduct(itemData);
        // }
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

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );
  }

  return (
      <ProductCard product={product} />
  );
};

export default ProductDisplay;