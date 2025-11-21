import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  // Added Table components
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useParams } from "react-router-dom";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CircularProgressBar from "./CircularProgressBar";
import ExportPreview from "./ExportPreview";
// Removed ItemListComponent import
import { getInventoryForm } from "../api/api";

// Define a type for the CSV data (assuming array of objects)
interface CsvItem extends Record<string, any> {}

interface ExportPageContentProps {
  items: any[];
  percentReviewed: number;
  activeCategory: "completed" | "broken";
  // NEW PROP: CSV Data
  csvData: CsvItem[]; 
}

export default function ExportPageContent({
  items,
  percentReviewed,
  activeCategory,
  csvData, // Destructure new prop
}: ExportPageContentProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  const completion = percentReviewed;
  const cardBorder = `1px solid ${theme.palette.divider}`;
  const team = "MNG INVENTORY";

  // --- CSV/Table Logic ---
  const headers = csvData.length > 0 ? Object.keys(csvData[0]) : [];
  // -----------------------

  // Existing logic for filtering items (kept for stats calculation)
  const filteredItems = items.filter((item) => {
    const status = (item.status ?? "to review").toLowerCase();
    
    if (activeCategory === "completed") {
      return status === "completed" || status === "complete" || status === "found";
    } else {
      return status === "damaged" || status === "shortages" || status === "shortage" || status === "missing" || status === "in repair";
    }
  });

  const categoryStats = {
    total: filteredItems.length,
    displayed: csvData.length, // Displayed is now based on CSV data length
    completed: activeCategory === "completed" ? filteredItems.length : 0,
    broken: activeCategory === "broken" ? filteredItems.length : 0,
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const data = await getInventoryForm(teamId, "2404");
      if (data?.url) {
        window.open(data.url, "_blank");
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

  // Component to render the table
  const CsvTable = () => (
    <TableContainer component={Box}>
      {csvData.length > 0 ? (
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {headers.map((header) => (
                <TableCell 
                  key={header} 
                  sx={{ 
                    fontWeight: 'bold', 
                    bgcolor: theme.palette.background.default,
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {csvData.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                {headers.map((header) => (
                  <TableCell key={header}>
                    {row[header]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Typography 
          sx={{ 
            textAlign: "center", 
            color: theme.palette.text.disabled, 
            py: 4 
          }}
        >
          No CSV data available to display.
        </Typography>
      )}
    </TableContainer>
  );


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
          <Box sx={{ display: "flex", gap: 3, minHeight: "calc(100vh - 200px)" }}>
            {/* Items List (Now CSV Table) */}
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
                  {activeCategory === "completed" 
                    ? "Completed Inventory Report" 
                    : "Broken Items Report"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Team: {team} {teamId && `• ID: ${teamId}`} • Items: {categoryStats.displayed}
                </Typography>
              </Box>

              {/* Items Display Area - REPLACED WITH CSV TABLE */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  bgcolor: theme.palette.background.default,
                }}
              >
                <CsvTable />
              </Box>
            </Paper>

            {/* Sidebar (No major changes) */}
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
                    {activeCategory === "completed" ? "Export Status" : "Broken Items"}
                  </Typography>
                  <CircularProgressBar value={completion} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {activeCategory === "completed" 
                      ? `${categoryStats.completed} completed items`
                      : `${categoryStats.broken} items require attention`}
                  </Typography>
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
                    Category: {activeCategory === "completed" ? "Completed Inventory" : "Broken Items"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Generated: {new Date().toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Format: CSV Data
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
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                mb: 3,
              }}
            >
              <Typography variant="h5" fontWeight={800} mb={1}>
                {activeCategory === "completed" ? "Completed Items" : "Broken Items"}
              </Typography>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Team: <strong>{team}</strong> {teamId && `• ID: ${teamId}`}
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

              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                {activeCategory === "completed" 
                  ? `${categoryStats.completed} completed items`
                  : `${categoryStats.broken} items require attention`}
              </Typography>

              <Stack spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ py: 1.5, fontWeight: 700 }}
                  onClick={handlePreviewOpen}
                >
                  View PDF
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PictureAsPdfIcon />}
                  onClick={handleDownloadPDF}
                  sx={{ py: 1.5, fontWeight: 700 }}
                >
                  Download PDF
                </Button>
              </Stack>
            </Paper>

            {/* Mobile Items List - REPLACED WITH CSV TABLE */}
            <Paper
              elevation={0}
              sx={{
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                p: 2,
              }}
            >
              <Typography variant="h6" fontWeight={800} mb={2}>
                CSV Data Preview
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                <CsvTable />
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