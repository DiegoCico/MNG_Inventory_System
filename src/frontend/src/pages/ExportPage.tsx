import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Stack,
  Typography,
  IconButton,
  Button,
  Paper,
  CircularProgress,
  useTheme,
  Avatar,
} from "@mui/material";
import { Link, useParams } from "react-router-dom";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import NavBar from "../components/NavBar";
import Profile from "../components/Profile";
import ExportPreview from "../components/ExportPreview";

export default function ExportPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const completion = 80;
  const cardBorder = `1px solid ${theme.palette.divider}`;

  const name = "Ben Tran";
  const email = "tran.b@northeastern.edu";
  const team = "MNG INVENTORY";
  const permissions = "Admin";

  const handleProfileImageChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        setProfileImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => window.print();
  const handleDownloadPDF = () => alert("PDF downloaded (stubbed)");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: theme.palette.background.default,
        overflowX: "hidden",
      }}
    >
      {/* Top AppBar */}
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }}>
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            sx={{
              flexGrow: 1,
              color: theme.palette.primary.contrastText,
              textDecoration: "none",
            }}
            component={Link}
            to="/"
          >
            <MilitaryTechIcon sx={{ color: theme.palette.primary.contrastText }} />
            <Typography variant="h6">SupplyNet</Typography>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 2, sm: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            border: cardBorder,
            bgcolor: theme.palette.background.paper,
            maxWidth: 500,
            width: "100%",
          }}
        >
          <Typography variant="h5" fontWeight={800} mb={1}>
            Inventory Export
          </Typography>

          <Typography variant="body2" color="text.secondary" mb={3}>
            Team ID: <strong>{teamId}</strong>
          </Typography>

          <Typography variant="body1" sx={{ mb: 2 }}>
            Review and export your completed inventory report.
          </Typography>

          {/* Completion Status */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 2,
              my: 2,
            }}
          >
            <Box position="relative" display="inline-flex">
              <CircularProgress
                variant="determinate"
                value={completion}
                size={100}
                thickness={4.5}
                sx={{ color: theme.palette.primary.main }}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  variant="h6"
                  component="div"
                  color="text.primary"
                  fontWeight={700}
                >
                  {`${Math.round(completion)}%`}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Inventory Completion
            </Typography>
          </Box>

          {/* Export Button */}
          <Box textAlign="center" mt={4}>
            <Button
              variant="contained"
              color="primary"
              sx={{
                px: 3,
                py: 1.2,
                fontWeight: 700,
                borderRadius: 2,
              }}
              onClick={() => setPreviewOpen(true)}
            >
              View Completed Form
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* PDF Preview Modal */}
      <ExportPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        completion={completion}
        team={team}
        onPrint={handlePrint}
        onDownload={handleDownloadPDF}
      />

      {/* Bottom Nav */}
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
