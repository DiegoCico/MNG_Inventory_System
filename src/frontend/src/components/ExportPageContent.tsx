import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTheme } from '@mui/material/styles';

// Define the core types used by the page component (normally imported from a shared file)

interface InventoryItem {
  itemId?: string;
  name?: string;
  status?: string;
  description?: string;
  createdAt: number;
  [key: string]: unknown;
}

// FIX 1 & 2: Define CsvItem explicitly to avoid empty interface and 'any' errors
interface CsvItem {
  'Item ID': string;
  'Product Name': string;
  Status: string;
  Description: string;
  'Date Added': string;
  'Team ID': string;
  [key: string]: unknown;
}

// FIX 3: Define component props using the explicit types
interface ExportPageContentProps {
  items: InventoryItem[]; // Replaced any[]
  percentReviewed: number;
  activeCategory: 'completed' | 'broken';
  csvData: CsvItem[]; // Replaced any[]
}

const ExportPageContent: React.FC<ExportPageContentProps> = ({
  items,
  percentReviewed,
  activeCategory,
  csvData,
}) => {
  const theme = useTheme();

  const fileName = `${activeCategory}_inventory_report_${new Date().toLocaleDateString()}.csv`;
  const totalItems = items.length;
  const filteredCount = csvData.length;

  const downloadCsv = () => {
    if (csvData.length === 0) {
      console.warn('No data to export.');
      return;
    }

    // Convert data to CSV string
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Handle null/undefined and escape inner quotes
            return `"${(value === null || value === undefined ? '' : String(value)).replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Paper
      elevation={4}
      sx={{
        p: { xs: 3, md: 6 },
        maxWidth: 800,
        mx: 'auto',
        mt: 4,
        borderRadius: 4,
        textAlign: 'center',
      }}
    >
      <FileDownloadIcon sx={{ fontSize: 70, color: theme.palette.success.main, mb: 2 }} />
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Documents Ready
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Your report for the **{activeCategory.toUpperCase()}** inventory is generated and ready for
        download.
      </Typography>

      <List
        sx={{
          maxWidth: 400,
          mx: 'auto',
          bgcolor: theme.palette.background.default,
          borderRadius: 2,
          mb: 4,
          p: 1,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <ListItem>
          <ListItemText
            primary="Report Type"
            secondary={
              activeCategory === 'completed' ? 'Completed/Found Items' : 'Damaged/Missing Items'
            }
          />
        </ListItem>
        <Divider />
        <ListItem>
          <ListItemText
            primary="Total Items Reviewed"
            secondary={`${percentReviewed}% (${totalItems - items.filter((i) => (i.status ?? '').toLowerCase() === 'to review').length}/${totalItems})`}
          />
        </ListItem>
        <Divider />
        <ListItem>
          <ListItemText primary="Items in Report" secondary={`${filteredCount} items`} />
        </ListItem>
      </List>

      <Button
        onClick={downloadCsv}
        variant="contained"
        size="large"
        startIcon={<FileDownloadIcon />}
        sx={{
          borderRadius: 2,
          px: 5,
          py: 1.5,
          fontWeight: 700,
          bgcolor: theme.palette.success.main,
          color: theme.palette.getContrastText(theme.palette.success.main),
          '&:hover': { bgcolor: theme.palette.success.dark },
        }}
      >
        Download {fileName.replace('.csv', '.CSV')}
      </Button>

      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="text.disabled">
          File Name: {fileName}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ExportPageContent;
