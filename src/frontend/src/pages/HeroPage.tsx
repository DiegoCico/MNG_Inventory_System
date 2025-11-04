import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import SecurityIcon from '@mui/icons-material/Security';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';

const features = [
  {
    title: 'Operational Readiness',
    description:
      'Maintain mission-critical equipment, vehicles, and supplies at optimal condition to support every operation.',
    icon: <AssessmentIcon />,
  },
  {
    title: 'Centralized Asset Tracking',
    description:
      'Track, allocate, and verify every item with full accountability and chain-of-custody visibility.',
    icon: <InventoryIcon />,
  },
  {
    title: 'Secure Infrastructure',
    description:
      'Encryption at rest and in transit, with role-based access and tamper-evident audit logs.',
    icon: <SecurityIcon />,
  },
  {
    title: 'Reliable Supply Chain',
    description:
      'Ensure every request, shipment, and delivery meets military standards for precision and reliability.',
    icon: <LocalShippingIcon />,
  },
];

function HeroPage() {
  const theme = useTheme();
  const downSm = useMediaQuery(theme.breakpoints.down('sm'));
  const [accessOpen, setAccessOpen] = useState(false);

  const heroBg = useMemo(() => ({ backgroundColor: '#F4F4F1' }), []);
  const cardBorder = `1px solid ${alpha('#000', 0.08)}`;

  return (
    <div className="HeroPage">
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: '#283996',
          color: '#F7F7F7',
          borderBottom: `1px solid ${alpha('#000', 0.1)}`,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexGrow: 1 }}>
            <MilitaryTechIcon />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
              SupplyNet
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              to="/signin"
              variant="contained"
              startIcon={<SecurityIcon />}
              sx={{
                bgcolor: '#D0A139', // yellow
                color: '#101214',
                ':hover': { bgcolor: '#B58827' },
                fontWeight: 800,
              }}
            >
              Sign In
            </Button>
            <Button
              variant="outlined"
              onClick={() => setAccessOpen(true)}
              sx={{
                color: '#F7F7F7',
                borderColor: alpha('#F7F7F7', 0.6),
                ':hover': { borderColor: '#fff', bgcolor: alpha('#F7F7F7', 0.1) },
                fontWeight: 800,
              }}
            >
              Request Access
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* HERO */}
      <Box sx={{ ...heroBg }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography
              component="h1"
              sx={{
                fontWeight: 900,
                color: '#1F1F1F',
                fontSize: { xs: '2.2rem', sm: '2.8rem', md: '3.2rem' },
                letterSpacing: 0.2,
                lineHeight: 1.1,
              }}
            >
              Military Inventory & Supply Command Hub
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: '#3A3A3A',
                maxWidth: 760,
                lineHeight: 1.6,
              }}
            >
              Secure, accountable, ready. Encrypt every record, verify every transaction, and keep assets
              mission-ready in perfect operational condition.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
              <Button
                component={Link}
                to="/signin"
                size={downSm ? 'medium' : 'large'}
                variant="contained"
                startIcon={<SecurityIcon />}
                sx={{
                  px: { xs: 2.25, sm: 3 },
                  bgcolor: '#D0A139', // yellow button
                  color: '#101214',
                  ':hover': { bgcolor: '#B58827' },
                  fontWeight: 900,
                }}
              >
                Enter Secure Portal
              </Button>
              <Button
                component={Link}
                to="/about"
                size={downSm ? 'medium' : 'large'}
                variant="text"
                sx={{
                  color: '#1F1F1F',
                  ':hover': { bgcolor: alpha('#283996', 0.08) },
                  fontWeight: 800,
                }}
              >
                Learn More
              </Button>
            </Stack>
          </Stack>

          {/* Features */}
          <Grid container spacing={2.5} sx={{ mt: { xs: 6, md: 8 }, justifyContent: 'center' }}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} key={f.title}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: cardBorder,
                    bgcolor: '#FFFFFF',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      py: 3,
                    }}
                  >
                    {/* changed icon color to blue */}
                    <Box sx={{ color: '#283996', mb: 0.5 }}>{f.icon}</Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1F1F1F' }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#3A3A3A', maxWidth: 340 }}>
                      {f.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <NavBar />

      {/* Request Access Dialog */}
      <Dialog
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        aria-labelledby="request-access-title"
        PaperProps={{
          sx: {
            bgcolor: '#FFFFFF',
            border: `1px solid ${alpha('#000', 0.15)}`,
          },
        }}
      >
        <DialogTitle id="request-access-title" sx={{ fontWeight: 800, color: '#1F1F1F' }}>
          Request Access
        </DialogTitle>
        <DialogContent dividers sx={{ color: '#3A3A3A' }}>
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
            sx={{ bgcolor: '#283996', ':hover': { bgcolor: '#1D2D77' } }}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default HeroPage;