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
import DescriptionIcon from '@mui/icons-material/Description';
import BlockIcon from '@mui/icons-material/Block';
import { useTheme } from '@mui/material/styles';
import ExportCategoryBar from './ExportCategoryBar';

interface InventoryItem {
  itemId?: string;
  name?: string;
  status?: string;
  description?: string;
  createdAt: number;
  [key: string]: unknown;
}

interface ExportDataResponse {
  ok?: boolean;
  url?: string;
  s3Url?: string;
  downloadBase64?: string;
  csvContent?: string;
  message?: string;
  filename?: string;
  [key: string]: unknown;
}

export interface ExportPageContentProps {
  items: InventoryItem[];
  percentReviewed: number;
  activeCategory: 'completed' | 'broken';
  onCategoryChange: (category: 'completed' | 'broken') => void;
  teamId: string;
  exportData: {
    pdf2404: ExportDataResponse;
    csvInventory: ExportDataResponse;
  };
}

const ExportPageContent: React.FC<ExportPageContentProps> = ({
  items,
  percentReviewed,
  activeCategory,
  onCategoryChange,
  teamId,
  exportData,
}) => {
  const theme = useTheme();

  // Calculate category-specific stats
  const completedItems = items.filter((i) => {
    const status = (i.status ?? '').toLowerCase();
    return ['completed', 'complete', 'missing', 'shortages', 'shortage'].includes(status);
  });

  const damagedItems = items.filter((i) => {
    const status = (i.status ?? '').toLowerCase();
    return status === 'damaged';
  });

  const totalItems = items.length;

  // Check which files are available - accept either csvContent OR url
  const hasPDF = exportData.pdf2404?.ok === true && 
                 !exportData.pdf2404?.message && 
                 (exportData.pdf2404?.url || exportData.pdf2404?.downloadBase64);
  
  const hasCSV = exportData.csvInventory?.ok === true && 
                 (exportData.csvInventory?.csvContent || exportData.csvInventory?.url);

  // Determine what to show based on active category
  const showingCompleted = activeCategory === 'completed';
  const hasFile = showingCompleted ? hasCSV : hasPDF;
  const itemCount = showingCompleted ? completedItems.length : damagedItems.length;
  const categoryLabel = showingCompleted ? 'Completed Items' : 'Broken Items';

  console.log('[ExportPageContent] Debug:', {
    activeCategory,
    hasCSV,
    hasPDF,
    hasFile,
    itemCount,
    csvOk: exportData.csvInventory?.ok,
    csvHasContent: !!exportData.csvInventory?.csvContent,
    csvHasUrl: !!exportData.csvInventory?.url,
    pdfOk: exportData.pdf2404?.ok,
    pdfMessage: exportData.pdf2404?.message
  });

  // Download handlers - only call when explicitly clicked
  const handleDownloadCSV = async (e?: React.MouseEvent) => {
    if (!e) return; // Prevent auto-execution
    
    try {
      if (exportData.csvInventory?.csvContent) {
        // Download from CSV content
        const blob = new Blob([exportData.csvInventory.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${teamId}_completed_inventory.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportData.csvInventory?.url) {
        // Download from presigned URL
        const response = await fetch(exportData.csvInventory.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${teamId}_completed_inventory.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download CSV:', error);
    }
  };

  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (!e) return; // Prevent auto-execution
    
    try {
      if (exportData.pdf2404?.url || exportData.pdf2404?.s3Url) {
        const pdfUrl = exportData.pdf2404.url || exportData.pdf2404.s3Url;
        if (!pdfUrl || typeof pdfUrl !== 'string') return;
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${teamId}_2404_form.pdf`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportData.pdf2404?.downloadBase64) {
        const binaryString = atob(exportData.pdf2404.downloadBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportData.pdf2404.filename || `${teamId}_2404_form.pdf`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

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

      {/* Category Bar */}
      <ExportCategoryBar 
        activeCategory={activeCategory} 
        onCategoryChange={onCategoryChange} 
      />

      {/* Stats Panel - Category Specific Only */}
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 500, p: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom textAlign="center">
          {showingCompleted ? 'Completed Inventory Summary' : 'Broken Items Summary'}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <List>
          <ListItem>
            <ListItemText
              primary={showingCompleted ? 'Completed/Missing/Shortage Items' : 'Damaged Items'}
              secondary={itemCount}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="Document Status"
              secondary={hasFile ? 'Ready to Download' : 'Not Generated'}
              secondaryTypographyProps={{ 
                color: hasFile ? 'success.main' : 'text.disabled',
                fontWeight: hasFile ? 600 : 400
              }}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="File Type"
              secondary={showingCompleted ? 'CSV Spreadsheet' : 'PDF Form (DA 2404)'}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
        </List>
      </Paper>

      {/* Download Button - Changes based on category */}
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        {showingCompleted && (
          <Button
            variant={hasCSV ? 'contained' : 'outlined'}
            startIcon={hasCSV ? <FileDownloadIcon /> : <BlockIcon />}
            onClick={hasCSV ? handleDownloadCSV : undefined}
            disabled={!hasCSV}
            fullWidth
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              fontWeight: 700,
              ...(hasCSV
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
            }}
          >
            {hasCSV ? 'Download Completed Inventory CSV' : 'No Items in Completed Items'}
          </Button>
        )}

        {!showingCompleted && (
          <Button
            variant={hasPDF ? 'contained' : 'outlined'}
            startIcon={hasPDF ? <DescriptionIcon /> : <BlockIcon />}
            onClick={hasPDF ? handleDownloadPDF : undefined}
            disabled={!hasPDF}
            fullWidth
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              fontWeight: 700,
              ...(hasPDF
                ? {
                    bgcolor: theme.palette.warning.main,
                    color: theme.palette.getContrastText(theme.palette.warning.main),
                    '&:hover': {
                      bgcolor: theme.palette.warning.dark,
                    },
                  }
                : {
                    borderColor: theme.palette.divider,
                    color: theme.palette.text.disabled,
                  }),
            }}
          >
            {hasPDF ? 'Download DA Form 2404 (PDF)' : 'No Items in Broken Items'}
          </Button>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
        {hasFile ? 'Click above to download your file.' : 'Add items with the appropriate status to generate this report.'}
      </Typography>
    </Box>
  );
};

export default ExportPageContent;