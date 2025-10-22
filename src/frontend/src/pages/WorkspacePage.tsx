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
  TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamIcon from '../components/TeamsComponent';

export default function TeamsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const downSm = useMediaQuery(theme.breakpoints.down('sm'));

  const heroBg = useMemo(() => ({ backgroundColor: '#F4F4F1' }), []);
  const appBarBlue = '#283996';
  const appBarText = '#F7F7F7';
  const ctaYellow = '#D0A139';
  const ctaYellowHover = '#B58827';

  // Mock data
  const teams = [
    { id: '1', name: 'Supply Trace', role: 'OWNER' },
    { id: '2', name: 'CS4535 (Fall 2025)', role: 'STUDENT' },
    { id: '3', name: 'NEU Hackathon', role: 'OWNER' },
    { id: '4', name: 'MNG Inventory', role: 'MEMBER' },
  ];

  /* ----------------------------- Filter states ----------------------------- */
  const [search, setSearch] = useState('');

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: heroBg.backgroundColor }}>
      {/* Header */}
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
        </Toolbar>
      </AppBar>

      {/* Body */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        {/* Header Row */}
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

        {/* Search Bar */}
        <Stack
          direction="row"
          sx={{
            mb: 3,
            bgcolor: '#fff',
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha('#000', 0.1)}`,
          }}
        >
          <TextField
            label="Search Teams"
            variant="outlined"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              sx: { color: '#000' }, // make input text black
            }}
            InputLabelProps={{
              sx: { color: '#000' }, // make label text black
            }}
          />
        </Stack>

        <Divider sx={{ mb: 3, borderColor: alpha('#000', 0.1) }} />

        {/* Teams Grid */}
        <Grid container spacing={2.5}>
          {filteredTeams.map((team) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={team.id}>
              <TeamIcon {...team} />
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredTeams.length === 0 && (
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
              No matching teams
            </Typography>
            <Typography variant="body2" sx={{ color: '#3A3A3A' }}>
              Try a different search.
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
