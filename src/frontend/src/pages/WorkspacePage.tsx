import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TeamIcon from '../components/TeamsComponent'; 

export default function TeamsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const downSm = useMediaQuery(theme.breakpoints.down('sm'));

  // Match HeroPage palette
  const heroBg = useMemo(() => ({ backgroundColor: '#F4F4F1' }), []);
  const appBarBlue = '#283996';
  const appBarText = '#F7F7F7';
  const ctaYellow = '#D0A139';
  const ctaYellowHover = '#B58827';

  const teams = [
    { id: '1', name: 'Supply Trace', role: 'OWNER' },
    { id: '2', name: 'CS4535 (Fall 2025)', role: 'STUDENT' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: heroBg.backgroundColor }}>
      {/* Header (same style as Hero) */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: appBarBlue,
          color: appBarText,
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
              startIcon={<GroupAddIcon />}
              sx={{
                bgcolor: ctaYellow,
                color: '#101214',
                ':hover': { bgcolor: ctaYellowHover },
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              Join or Create Team
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Body */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={2}
          mb={2.5}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              color: '#1F1F1F',
              letterSpacing: 0.2,
              lineHeight: 1.1,
            }}
          >
            Workplace
          </Typography>

          <Button
            variant="contained"
            onClick={() => navigate('/teams/new')}
            startIcon={<GroupAddIcon />}
            size={downSm ? 'medium' : 'large'}
            sx={{
              bgcolor: ctaYellow,
              color: '#101214',
              ':hover': { bgcolor: ctaYellowHover },
              fontWeight: 900,
              textTransform: 'none',
              px: { xs: 2.25, sm: 3 },
            }}
          >
            Join or Create Team
          </Button>
        </Stack>

        <Divider sx={{ mb: 3, borderColor: alpha('#000', 0.1) }} />

        <Grid container spacing={2.5}>
          {teams.map((team) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={team.id}>
              {/* Your icon card component (click -> /teams/:id) */}
              <TeamIcon {...team} />
            </Grid>
          ))}
        </Grid>

        {/* Optional: empty state */}
        {teams.length === 0 && (
          <Box
            sx={{
              mt: 6,
              p: 4,
              borderRadius: 2,
              bgcolor: '#FFFFFF',
              border: `1px solid ${alpha('#000', 0.08)}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1F1F1F', mb: 1 }}>
              No teams yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#3A3A3A', mb: 2 }}>
              Create or join a team to get started.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/teams/new')}
              sx={{
                bgcolor: ctaYellow,
                color: '#101214',
                ':hover': { bgcolor: ctaYellowHover },
                fontWeight: 800,
              }}
            >
              Join or Create Team
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  );
}
