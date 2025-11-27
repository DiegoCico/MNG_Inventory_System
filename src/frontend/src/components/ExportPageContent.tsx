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
import BlockIcon from '@mui/icons-material/Block';
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
  const hasData = filteredCount > 0;

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

  // Capitalize first letter for button text
  const categoryDisplay = activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        p: 3,
      }}
    >
      <Typography variant="h4" fontWeight={700} textAlign="center">
        Documents Ready
      </Typography>

      <Typography variant="body1" textAlign="center" color="text.secondary">
        Your report for the <strong>{activeCategory.toUpperCase()}</strong> inventory is
        generated and ready for download.
      </Typography>

      <Paper elevation={3} sx={{ width: '100%', maxWidth: 500, p: 3 }}>
        <List>
          <ListItem>
            <ListItemText
              primary="Total Items"
              secondary={totalItems}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="Filtered Items"
              secondary={filteredCount}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="Review Progress"
              secondary={`${percentReviewed}% (${items.filter((i) => (i.status ?? '').toLowerCase() === 'to review').length}/${totalItems})`}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
        </List>
      </Paper>

      <Button
        variant={hasData ? 'contained' : 'outlined'}
        startIcon={hasData ? <FileDownloadIcon /> : <BlockIcon />}
        onClick={hasData ? downloadCsv : undefined}
        disabled={!hasData}
        fullWidth
        sx={{
          borderRadius: 2,
          px: 3,
          py: 1.5,
          fontWeight: 700,
          ...(hasData
            ? {
                bgcolor: theme.palette.success.main,
                color: theme.palette.getContrastText(theme.palette.success.main),
                '&:hover': {
                  bgcolor: theme.palette.success.dark,
                },
              }
            : {
                borderColor: theme.palette.divider,
                color: theme.palette.text.disabled,
              }),
          maxWidth: { xs: '100%', sm: 400 },
        }}
      >
        {hasData ? `Download ${categoryDisplay} Report CSV` : 'No Items to Download'}
      </Button>

      <Typography variant="caption" color="text.secondary">
        File Name: {fileName}
      </Typography>
    </Box>
  );
};

export default ExportPageContent;