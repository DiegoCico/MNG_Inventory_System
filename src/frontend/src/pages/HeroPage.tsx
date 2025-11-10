import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import SecurityIcon from "@mui/icons-material/Security";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TopBar from "../components/TopBar";

const features = [
  {
    title: "Operational Readiness",
    description:
      "Maintain mission-critical equipment, vehicles, and supplies at optimal condition to support every operation.",
    icon: <AssessmentIcon />,
  },
  {
    title: "Centralized Asset Tracking",
    description:
      "Track, allocate, and verify every item with full accountability and chain-of-custody visibility.",
    icon: <InventoryIcon />,
  },
  {
    title: "Secure Infrastructure",
    description:
      "Encryption at rest and in transit, with role-based access and tamper-evident audit logs.",
    icon: <SecurityIcon />,
  },
  {
    title: "Reliable Supply Chain",
    description:
      "Ensure every request, shipment, and delivery meets military standards for precision and reliability.",
    icon: <LocalShippingIcon />,
  },
];

export default function HeroPage() {
  const theme = useTheme();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [accessOpen, setAccessOpen] = useState(false);

  // dynamic background and card border based on theme
  const heroBg = useMemo(
    () => ({
      backgroundColor:
        theme.palette.mode === "light" ? "#F4F4F1" : theme.palette.background.default,
    }),
    [theme.palette.mode]
  );
  const cardBorder = `1px solid ${alpha(theme.palette.divider, 0.4)}`;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* TopBar: Sign In + Request Access */}
      <TopBar
        isLoggedIn={false}
        onRequestAccess={() => setAccessOpen(true)}
      />

      {/* Hero Section */}
      <Box sx={{ ...heroBg }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography
              component="h1"
              sx={{
                fontWeight: 900,
                color: theme.palette.text.primary,
                fontSize: { xs: "2.2rem", sm: "2.8rem", md: "3.2rem" },
                letterSpacing: 0.2,
                lineHeight: 1.1,
              }}
            >
              Military Inventory & Supply Command Hub
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: theme.palette.text.secondary,
                maxWidth: 760,
                lineHeight: 1.6,
              }}
            >
              Secure, accountable, ready. Encrypt every record, verify every transaction, and keep assets
              mission-ready in perfect operational condition.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 3 }}>
              <Button
                component="a"
                href="/signin"
                size={downSm ? "medium" : "large"}
                variant="contained"
                startIcon={<SecurityIcon />}
                sx={{
                  px: { xs: 2.25, sm: 3 },
                  bgcolor: theme.palette.warning.main,
                  color: theme.palette.warning.contrastText,
                  ":hover": { bgcolor: theme.palette.warning.dark },
                  fontWeight: 900,
                }}
              >
                Enter Secure Portal
              </Button>
              <Button
                component="a"
                href="/about"
                size={downSm ? "medium" : "large"}
                variant="text"
                sx={{
                  color: theme.palette.text.primary,
                  ":hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                  fontWeight: 800,
                }}
              >
                Learn More
              </Button>
            </Stack>
          </Stack>

          {/* Features */}
          <Grid container spacing={2.5} sx={{ mt: { xs: 6, md: 8 }, justifyContent: "center" }}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} key={f.title}>
                <Card
                  elevation={0}
                  sx={{
                    height: "100%",
                    border: cardBorder,
                    bgcolor: theme.palette.background.paper,
                    boxShadow: theme.shadows[1],
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: theme.shadows[4],
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                      py: 3,
                    }}
                  >
                    <Box sx={{ color: theme.palette.primary.main, mb: 0.5 }}>{f.icon}</Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, maxWidth: 340 }}>
                      {f.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Request Access Dialog */}
      <Dialog
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        aria-labelledby="request-access-title"
        PaperProps={{
          sx: {
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
          Request Access
        </DialogTitle>
        <DialogContent dividers sx={{ color: theme.palette.text.secondary }}>
          <Typography gutterBottom>
            To obtain access, please coordinate through your chain of command.
          </Typography>
          <Typography gutterBottom>
            Speak with your <strong>unit sergeant</strong> and request that they submit an approval on your behalf.
            Once approved, you will receive a <strong>secure invitation link</strong> to complete enrollment.
          </Typography>
          <Typography>
            For security reasons, self-registration is not available on this system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAccessOpen(false)}
            variant="contained"
            sx={{ bgcolor: theme.palette.primary.main, ":hover": { bgcolor: theme.palette.primary.dark } }}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
