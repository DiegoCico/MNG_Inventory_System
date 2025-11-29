import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Fade,
  useTheme,
  Alert,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import ExportPageContent from '../components/ExportPageContent';
import ExportCategoryBar from '../components/ExportCategoryBar';
import { getItems } from '../api/items';
import { generateExportDocuments } from '../api/download';

// Define the interface for the raw item object received from the API
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

export default function ExportPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'completed' | 'broken'>('completed');
  const [error, setError] = useState<string | null>(null);

  // Fetch items on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!teamId) return;

      try {
        const result = await getItems(teamId);
        setItems(Array.isArray(result.items) ? (result.items as InventoryItem[]) : []);
      } catch (err) {
        console.error('Failed to load items:', err);
        setError('Failed to load inventory items');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

  // Compute totals + percentReviewed AFTER items have loaded
  const totals = { toReview: 0, completed: 0, shortages: 0, damaged: 0 };

  for (const item of items) {
    const status = (item.status ?? 'to review').toLowerCase();

    switch (status) {
      case 'to review':
        totals.toReview++;
        break;
      case 'completed':
        totals.completed++;
        break;
      case 'shortages':
        totals.shortages++;
        break;
      case 'damaged':
        totals.damaged++;
        break;
      default:
        totals.toReview++;
    }
  }

  const totalReviewed = totals.completed + totals.shortages + totals.damaged;
  const totalCount = totalReviewed + totals.toReview;
  const percentReviewed = totalCount > 0 ? Math.round((totalReviewed / totalCount) * 100) : 0;

  // UI state for document generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentsCreated, setDocumentsCreated] = useState(false);
  const [exportData, setExportData] = useState<{
    pdf2404: ExportDataResponse;
    csvInventory: ExportDataResponse;
  } | null>(null);

  // Generate documents and pass data to ExportPageContent
  const handleCreateDocuments = async () => {
    if (!teamId) {
      setError('Team ID is missing');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setDocumentsCreated(false);

    try {
      // Call the generation utility (waits for backend to finish, but does NOT download)
      const result = await generateExportDocuments(teamId);
      
      // Store the export data to pass to ExportPageContent
      setExportData({
        pdf2404: result.pdf2404,
        csvInventory: result.csvInventory,
      });

      // Show success state with download buttons
      setDocumentsCreated(true);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to create documents:', error);
      setError(error.message || 'Failed to generate documents');
      setDocumentsCreated(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} />

      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 3, md: 5 }, pb: 10 }}>
        {/* ERROR ALERT */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* LOADING WHILE FETCHING ITEMS */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
            <CircularProgress />
          </Box>
        )}

        {/* CATEGORY BAR - Always visible after loading */}
        {!loading && (
          <Fade in timeout={400}>
            <Box>
              <ExportCategoryBar 
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </Box>
          </Fade>
        )}

        {/* PAGE CONTENT WHEN NOT LOADING */}
        {!loading && !documentsCreated && !isGenerating && (
          <Fade in timeout={400}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                maxWidth: 600,
                mx: 'auto',
                textAlign: 'center',
                mt: { xs: 6, md: 10 },
                borderRadius: 4,
              }}
            >
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Create Inventory Documents
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generate your team's completed inventory form for export.
              </Typography>

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Inventory Completion: {percentReviewed}%
              </Typography>

              <LinearProgress
                variant="determinate"
                value={percentReviewed}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  mb: 4,
                }}
              />

              <Button
                onClick={handleCreateDocuments}
                variant="contained"
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontWeight: 700,
                  bgcolor: theme.palette.warning.main,
                  color: theme.palette.getContrastText(theme.palette.warning.main),
                  '&:hover': { bgcolor: theme.palette.warning.dark },
                }}
              >
                Create Documents
              </Button>
            </Paper>
          </Fade>
        )}

        {/* GENERATING STATE */}
        {isGenerating && (
          <Fade in timeout={400}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minHeight: '70vh',
                justifyContent: 'center',
              }}
            >
              <CircularProgress size={60} thickness={5} sx={{ mb: 3 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Generating your documents...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center', maxWidth: 400 }}>
                Please wait while we:
              </Typography>
              <Box component="ul" sx={{ mt: 2, textAlign: 'left', color: 'text.secondary' }}>
                <li>Query your inventory data</li>
                <li>Generate PDF and CSV reports</li>
                <li>Upload files to secure storage</li>
                <li>Prepare download links</li>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                This may take 10-30 seconds depending on your inventory size
              </Typography>
            </Box>
          </Fade>
        )}

        {/* AFTER GENERATION - Pass data to ExportPageContent */}
        {documentsCreated && exportData && (
          <Fade in timeout={500}>
            <Box>
              <ExportPageContent
                items={items}
                percentReviewed={percentReviewed}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                teamId={teamId || ''}
                exportData={exportData}
              />
            </Box>
          </Fade>
        )}
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}
      >
        <NavBar />
      </Box>
    </Box>
  );
}