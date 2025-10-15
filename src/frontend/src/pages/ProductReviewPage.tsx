import React from 'react';
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
  Typography
} from '@mui/material';
import PercentageBar from '../components/PercentageBar';

interface ItemViewModel {
  productName: string;
  actualName: string,
  level: string,
  description: string,
  imageLink: string,
  serialNumber: string,
  AuthQuantity: number
}

interface ProductCardProps {
  product: ItemViewModel;
}

const ProductCard = ({ product } : ProductCardProps) => {
  const [status, setStatus] = React.useState('Found');
  const [notes, setNotes] = React.useState(product.description);

  return (
    <Container maxWidth="md" sx={{
      px: { xs: 0, sm: 2, md: 3 }
    }}>
      <Card>
        <PercentageBar />

        {/* Product Image */}
        <CardMedia
          component="img"
          image={product.imageLink}
          alt={product.productName}
          sx={{
            maxHeight: '40vh',
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
              bgcolor: '#81c784',
              '&:hover': { bgcolor: '#66bb6a' },
              textTransform: 'none',
              fontWeight: 'bold'
            }}
          >
            Complete
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
};

// Example Usage Component
const ProductDisplay = () => {
  const productInformation: ItemViewModel[] = [
    {
      productName: 'Laptop Computer, Portable',
      actualName: 'TechPro X1 - 15" Business Laptop',
      level: 'B',
      description: 'High-performance business laptop with Intel i7 processor, 16GB RAM, 512GB SSD, and enterprise security features',
      imageLink: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fpurepng.com%2Fpublic%2Fuploads%2Flarge%2Fpurepng.com-laptoplaptoptechnologyelectronicskeyboard-1121525119750ab9ua.png&f=1&nofb=1&ipt=0562cfdfa1101b7aee94878cf35c3dfb8338e52a2c027772ea3e8d6bc8600df9',
      serialNumber: '',
      AuthQuantity: 2
    },
    {
      productName: 'Monitor, LCD Display',
      actualName: 'ViewMax Pro 27" 4K Monitor',
      level: 'C',
      description: '27-inch 4K UHD monitor with IPS panel, HDR support, and USB-C connectivity for professional workstations',
      imageLink: '',
      serialNumber: '',
      AuthQuantity: 10
    },
    {
      productName: 'Headset, Wireless Audio',
      actualName: 'SoundWave Elite - Noise Cancelling Headset',
      level: 'A',
      description: 'Premium wireless headset with active noise cancellation, 30-hour battery life, and crystal-clear microphone for calls',
      imageLink: '',
      serialNumber: '',
      AuthQuantity: 15
    }
  ];

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
      <ProductCard product={productInformation[0]} />
    </Box>
  );
};

export default ProductDisplay;