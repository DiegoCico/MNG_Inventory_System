import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Fade,
  useTheme,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import ExportPageContent from '../components/ExportPageContent';

export default function ExportPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"completed" | "broken">("completed");

  // Fetch items on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!teamId) return;

      try {
        const result = await getItems(teamId);
        setItems(Array.isArray(result.items) ? result.items : []);
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

  // Compute totals + percentReviewed AFTER items have loaded
  const totals = { toReview: 0, completed: 0, shortages: 0, damaged: 0 };

  for (const item of items) {
    const status = (item.status ?? "to review").toLowerCase();

    switch (status) {
      case "to review":
        totals.toReview++;
        break;
      case "completed":
        totals.completed++;
        break;
      case "shortages":
        totals.shortages++;
        break;
      case "damaged":
        totals.damaged++;
        break;
      default:
        totals.toReview++;
    }
  }

  const totalReviewed = totals.completed + totals.shortages + totals.damaged;
  const totalCount = totalReviewed + totals.toReview;

  const percentReviewed =
    totalCount > 0 ? Math.round((totalReviewed / totalCount) * 100) : 0;

  // UI state for document generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentsCreated, setDocumentsCreated] = useState(false);

  const handleCreateDocuments = async () => {
    setIsGenerating(true);
    await new Promise((res) => setTimeout(res, 3000)); // simulate generation
    setIsGenerating(false);
    setDocumentsCreated(true);
  };
  
  // --- NEW: Transform items into the CSV data structure ---
  const csvData = itemsToCsvData(items, activeCategory, teamId || '');
  // --------------------------------------------------------

  // Category bar categories
  const categories = [
    {
      id: "completed" as const,
      label: "Completed Inventory",
      icon: <CheckCircleIcon />,
    },
    {
      id: "broken" as const,
      label: "Broken Items",
      icon: <BuildIcon />,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      {/* ✅ TopBar always visible */}
      <TopBar isLoggedIn={true} />

      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 3, md: 5 }, pb: 10 }}>
        {/* LOADING WHILE FETCHING ITEMS */}
        {loading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: 10,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* CATEGORY BAR - Shows after loading completes */}
        {!loading && (
          <Fade in timeout={400}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 2,
                mb: 4,
                flexWrap: "wrap",
              }}
            >
              {categories.map((category) => {
                const isActive = activeCategory === category.id;

                return (
                  <Button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    startIcon={category.icon}
                    variant={isActive ? "contained" : "outlined"}
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1.5,
                      fontWeight: 700,
                      textTransform: "none",
                      fontSize: "1rem",
                      minWidth: 200,
                      border: isActive
                        ? "none"
                        : `2px solid ${theme.palette.divider}`,
                      bgcolor: isActive ? theme.palette.warning.main : "transparent",
                      color: isActive
                        ? theme.palette.getContrastText(theme.palette.warning.main)
                        : theme.palette.text.primary,
                      "&:hover": {
                        bgcolor: isActive
                          ? theme.palette.warning.dark
                          : theme.palette.action.hover,
                        border: isActive
                          ? "none"
                          : `2px solid ${theme.palette.text.secondary}`,
                      },
                    }}
                  >
                    {category.label}
                  </Button>
                );
              })}
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

              {/* REAL percentReviewed */}
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
                justifyContent: 'center',
                minHeight: '70vh',
                textAlign: 'center',
              }}
            >
              <CircularProgress size={60} thickness={5} sx={{ mb: 3 }} />
              <Typography variant="h6">Generating your documents...</Typography>
            </Box>
          </Fade>
        )}

        {/* AFTER GENERATION */}
        {documentsCreated && (
          <Fade in timeout={500}>
            <Box>
              <ExportPageContent 
                items={items} 
                percentReviewed={percentReviewed}
                activeCategory={activeCategory}
                // PASSED THE GENERATED CSV DATA
                csvData={csvData} 
              />
            </Box>
          </Fade>
        )}
      </Box>

      {/* NavBar always visible */}
      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}