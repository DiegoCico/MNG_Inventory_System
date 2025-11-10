import React, { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  LinearProgress,
  Fade,
  useTheme,
} from "@mui/material";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import NavBar from "../components/NavBar";
import ExportPageContent from "../components/ExportPageContent";

export default function ExportPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();

  const [isGenerating, setIsGenerating] = useState(false);
  const [documentsCreated, setDocumentsCreated] = useState(false);
  const completion = 80; // mock value

  const handleCreateDocuments = async () => {
    setIsGenerating(true);
    await new Promise((res) => setTimeout(res, 3000)); // simulate generation delay
    setIsGenerating(false);
    setDocumentsCreated(true);
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.background.default }}>
      {/* ✅ TopBar always visible */}
      <TopBar isLoggedIn={true} />

      {/* Main Body */}
      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 3, md: 5 }, pb: 10 }}>
        {/* Step 1: Show Create Documents Card */}
        {!documentsCreated && !isGenerating && (
          <Fade in timeout={400}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                maxWidth: 600,
                mx: "auto",
                textAlign: "center",
                mt: { xs: 6, md: 10 },
                borderRadius: 4,
              }}
            >
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Create Inventory Documents
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generate your team’s completed inventory form for export.
              </Typography>

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Inventory Completion: {completion}%
              </Typography>

              <LinearProgress
                variant="determinate"
                value={completion}
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
                  "&:hover": { bgcolor: theme.palette.warning.dark },
                }}
              >
                Create Documents
              </Button>
            </Paper>
          </Fade>
        )}

        {/* Step 2: Loading State */}
        {isGenerating && (
          <Fade in timeout={400}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "70vh",
                textAlign: "center",
              }}
            >
              <CircularProgress size={60} thickness={5} sx={{ mb: 3 }} />
              <Typography variant="h6">Generating your documents...</Typography>
            </Box>
          </Fade>
        )}

        {/* Step 3: After Done -> Show Your Current Page */}
        {documentsCreated && (
          <Fade in timeout={500}>
            <Box>
              <ExportPageContent />
            </Box>
          </Fade>
        )}
      </Box>

      {/* NavBar always visible */}
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
