import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useParams } from "react-router-dom";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CircularProgressBar from "./CircularProgressBar";
import ExportPreview from "./ExportPreview";
import { getInventoryForm } from "../api/api";

export default function ExportPageContent() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [previewOpen, setPreviewOpen] = useState(false);

  // Local state for fetched PDF
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Temporary static values
  const completion = 80;
  const cardBorder = `1px solid ${theme.palette.divider}`;
  const team = "MNG INVENTORY";


  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const data = await getInventoryForm(teamId, "2404"); // or dynamic nsn
      if (data?.url) {
        window.open(data.url, "_blank"); // opens PDF in new tab
      } else {
        alert("PDF not found or could not be retrieved.");
      }
    } catch (err: unknown) {
      console.error("Error fetching inventory form:", err);
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to fetch PDF.");
      }
    }
  };

  const handlePreviewOpen = async () => {
    try {
      const data = await getInventoryForm(teamId, "2404");
      if (data?.url) {
        setPdfUrl(data.url);
        setPreviewOpen(true);
      } else {
        alert("PDF not found.");
      }
    } catch (err: unknown) {
      console.error("Error fetching preview:", err);
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to open preview.");
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          bgcolor: theme.palette.background.default,
          p: { xs: 2, sm: 3, md: 4 },
          color: theme.palette.text.primary,
          pb: { xs: 12, sm: 14 },
        }}
      >
        {isDesktop ? (
          // Desktop Layout
          <Box sx={{ display: "flex", gap: 3, height: "calc(100vh - 140px)" }}>
            {/* PDF Viewer */}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  p: 2,
                  borderBottom: cardBorder,
                  bgcolor: theme.palette.background.default,
                }}
              >
                <Typography variant="h6" fontWeight={800}>
                  Completed Inventory Form
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Team: {team} {teamId && `• ID: ${teamId}`}
                </Typography>
              </Box>

              {/* PDF Display Area */}
              <Box
                sx={{
                  flex: 1,
                  p: 0,
                  bgcolor: theme.palette.mode === "dark" ? "#1a1a1a" : "#f5f5f5",
                }}
              >
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                    title="Inventory Form PDF"
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: theme.palette.text.secondary,
                    }}
                  >
                    <Typography variant="body1">
                      PDF not loaded — click “Download PDF” or “View Completed Form”.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Sidebar */}
            <Box sx={{ width: 320 }}>
              <Stack spacing={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Export Status
                  </Typography>
                  <CircularProgressBar value={completion} />
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={3}>
                    Export Actions
                  </Typography>
                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      startIcon={<PrintIcon />}
                      onClick={handlePrint}
                      sx={{ py: 1.5, fontWeight: 700 }}
                    >
                      Print Report
                    </Button>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={handleDownloadPDF}
                      sx={{
                        py: 1.5,
                        fontWeight: 700,
                        bgcolor: theme.palette.warning.main,
                        color: theme.palette.getContrastText(theme.palette.warning.main),
                        "&:hover": {
                          bgcolor: theme.palette.warning.dark,
                        },
                      }}
                    >
                      Download PDF
                    </Button>
                  </Stack>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>
                    Document Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Generated: {new Date().toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Format: PDF Document
                  </Typography>
                </Paper>
              </Stack>
            </Box>
          </Box>
        ) : (
          // Mobile Layout
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 4,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                maxWidth: 600,
                width: "100%",
              }}
            >
              <Typography variant="h5" fontWeight={800} mb={1}>
                Inventory Export
              </Typography>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Team: <strong>{team}</strong> {teamId && `• ID: ${teamId}`}
              </Typography>

              <Typography variant="body1" sx={{ mb: 3 }}>
                Review and export your completed inventory report.
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  my: 3,
                }}
              >
                <CircularProgressBar value={completion} />
              </Box>

              <Box sx={{ mt: 4 }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                  }}
                  onClick={handlePreviewOpen}
                >
                  View Completed Form
                </Button>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>

      {/* PDF Preview Modal (Mobile Only) */}
      <ExportPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={pdfUrl || ""}
        completion={completion}
        team={team}
        onPrint={handlePrint}
        onDownload={handleDownloadPDF}
      />

      {/* Bottom Nav */}
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
      </Box>
    </Box>
  );
}
