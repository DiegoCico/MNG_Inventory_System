import React from 'react';
import { Box, Typography, Stack, IconButton, Paper, Button, useTheme, Modal } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PrintIcon from '@mui/icons-material/Print';

interface ExportPreviewProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  completion: number;
  team: string;
  onPrint: () => void;
  onDownload: () => void;
}

const ExportPreview: React.FC<ExportPreviewProps> = ({
  open,
  onClose,
  pdfUrl,
  completion,
  team,
  onPrint,
  onDownload,
}) => {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '95%',
          maxWidth: 1400,
          height: '90vh',
          bgcolor: theme.palette.background.default,
          borderRadius: 2,
          boxShadow: 24,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* PDF Viewer - Left Side */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: cardBorder,
              bgcolor: theme.palette.background.paper,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Completed Inventory Form
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Team: {team}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* PDF Preview Area */}
          <Box
            sx={{
              flex: 1,
              p: 3,
              overflowY: 'auto',
              bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
            }}
          >
            {/* Simulated PDF Content */}
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                width="100%"
                height="100%"
                style={{
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
                }}
                title="Inventory Form PDF"
              />
            ) : (
              <Paper
                elevation={2}
                sx={{
                  maxWidth: 800,
                  mx: 'auto',
                  p: 4,
                  bgcolor: theme.palette.background.paper,
                  minHeight: '100%',
                }}
              >
                <Typography variant="h5" fontWeight={800} gutterBottom align="center">
                  INVENTORY COMPLETION REPORT
                </Typography>

                <Box sx={{ mt: 4 }}>
                  <Typography variant="body2" align="center" color="text.secondary">
                    PDF not yet loaded — click “Download PDF” or “View Completed Form”.
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>

        {/* Sidebar - Right Side */}
        <Box
          sx={{
            width: 320,
            borderLeft: cardBorder,
            bgcolor: theme.palette.background.default,
            p: 3,
            overflowY: 'auto',
          }}
        >
          <Stack spacing={3}>
            {/* Completion Status Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" fontWeight={800} mb={2}>
                Export Status
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  my: 2,
                }}
              >
                <Box position="relative" display="inline-flex">
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      border: `8px solid ${theme.palette.primary.main}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h4" fontWeight={800}>
                      {completion}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Inventory Completion
              </Typography>
            </Paper>

            {/* Action Buttons Card */}
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
                  onClick={onPrint}
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                  }}
                >
                  Print Report
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={onDownload}
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                    bgcolor: theme.palette.warning.main,
                    color: theme.palette.getContrastText(theme.palette.warning.main),
                    '&:hover': {
                      bgcolor: theme.palette.warning.dark,
                    },
                  }}
                >
                  Download PDF
                </Button>
              </Stack>
            </Paper>

            {/* Info Card */}
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
    </Modal>
  );
};

export default ExportPreview;
