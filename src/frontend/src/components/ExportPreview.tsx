import React from "react";
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Paper,
  Button,
  useTheme,
  Modal,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";

interface ExportPreviewProps {
  open: boolean;
  onClose: () => void;
  completion: number;
  team: string;
  onPrint: () => void;
  onDownload: () => void;
}

const ExportPreview: React.FC<ExportPreviewProps> = ({
  open,
  onClose,
  completion,
  team,
  onPrint,
  onDownload,
}) => {
  const theme = useTheme();

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "90%",
          maxWidth: 700,
          maxHeight: "85vh",
          overflowY: "auto",
          bgcolor: theme.palette.background.paper,
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
        }}
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={800}>
            Completed Inventory Form
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* PDF-like Content */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.default,
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Inventory Summary
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Team: {team}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Completion: {completion}%
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Date Generated: {new Date().toLocaleDateString()}
          </Typography>

          <Box
            sx={{
              mt: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
              pt: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Example data table or content that represents what the PDF will contain.
            </Typography>
          </Box>
        </Paper>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={onPrint}
          >
            Print Form
          </Button>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            onClick={onDownload}
            sx={{
              bgcolor: theme.palette.warning.main,
              color: theme.palette.getContrastText(theme.palette.warning.main),
              "&:hover": { bgcolor: theme.palette.warning.dark },
            }}
          >
            Download Form
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default ExportPreview;
