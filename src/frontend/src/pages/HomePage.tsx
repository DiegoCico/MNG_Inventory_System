/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Profile from '../components/Profile';

import InventoryStatus from '../components/HomePage/InventoryStatus';
import InventoryReviewed from '../components/HomePage/InventoryReviewed';
import FollowUpsTable from '../components/HomePage/FollowUpsTable';
import AddInventoryCard from '../components/HomePage/AddInventoryCard';
import RestartInventoryProcess from '../components/HomePage/RestartInventoryCard';
import TeamActivityChart from '../components/HomePage/TeamActivityChart';

import { getItems } from '../api/items';
import { me } from '../api/auth'; // Import your auth function
import { getTeam } from '../api/home';

export default function HomePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [teamName, setTeamName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeMode, setTimeMode] = useState<'hours' | 'days'>('hours');
  const [selectedValue, setSelectedValue] = useState<number>(5); // default
  const [items, setItems] = useState<any[]>([]); // new state for raw items

  // pull data for dashboard components from DynamoDB
  useEffect(() => {
    const getDashboardData = async (): Promise<void> => {
      if (!teamId) {
        setError('Missing team ID');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // Get current user for auth
        const currentUser = await me();

        // use getItems function and summarize a subset of data to populate the different dashboard components
                // Fetch team data and items in parallel
        const [teamResult, itemsResult] = await Promise.all([
          getTeam(teamId, currentUser.userId),
          getItems(teamId)
        ]);

        // Set team name
        if (teamResult.success && teamResult.team) {
          setTeamName(teamResult.team.name);
        }

        //const result = await getItems(teamId);

        // Process items data
        if (!itemsResult.success || !itemsResult.items) {
          setError(itemsResult.error || 'Failed to fetch items');
          return;
        }

        //const items = Array.isArray(result.items) ? result.items : [];
        const fetchedItems = Array.isArray(itemsResult.items) ? itemsResult.items : [];
        setItems(fetchedItems); // store raw items

        // define dashboard constants
        const totals = { toReview: 0, completed: 0, shortages: 0, damaged: 0 };
        const users: Record<string, { completed: number; shortages: number; damaged: number }> = {};

        const followUps: Array<{
          itemId: string;
          name: string;
          status: string;
          updatedAt: string;
          createdBy: string;
          parent: string;
        }> = [];
        for (const item of fetchedItems) {
          const status = (item.status ?? 'To Review').toLowerCase();
          const createdBy = item.createdBy ?? 'unknown';

          // Inventory Status statistics
          switch (status) {
            case 'to review':
              totals.toReview++;
              break;
            case 'completed':
              totals.completed++;
              break;
            case 'shortages':
              totals.shortages++;
              break;
            case 'damaged':
              totals.damaged++;
              break;
            default:
              totals.toReview++;
          }
          if (!users[createdBy]) users[createdBy] = { completed: 0, shortages: 0, damaged: 0 };
          if (status === 'completed') users[createdBy].completed++;
          if (status === 'shortages') users[createdBy].shortages++;
          if (status === 'damaged') users[createdBy].damaged++;

          // Follow-Ups statistics
          if (status === 'damaged' || status === 'shortages') {
            followUps.push({
              itemId: item.itemId,
              name: item.name,
              status,
              parent: item.parent ?? 'N/A',
              updatedAt: item.updatedAt ?? '',
              createdBy,
            });
          }
        }

        const totalReviewed = totals.completed + totals.shortages + totals.damaged;
        const totalCount = totalReviewed + totals.toReview;
        const percentReviewed = totalCount > 0 ? Math.round((totalReviewed / totalCount) * 100) : 0;

        const overview = {
          totals,
          percentReviewed,
          teamStats: Object.entries(users).map(([userId, data]) => ({ userId, ...data })),
          followUps,
        };

        setDashboardData(overview);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getDashboardData();
  }, [teamId, timeMode, selectedValue]);

  const totals = dashboardData?.totals || { toReview: 0, completed: 0, shortages: 0, damaged: 0 };
  const percentReviewed = dashboardData?.percentReviewed || 0;
  const teamStats = dashboardData?.teamStats || [];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar isLoggedIn onProfileClick={() => setProfileOpen(true)} />
      <Box sx={{ flex: 1, p: 4 }}>
        <Box mb={3}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/teams')}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: theme.palette.text.primary,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
            }}
          >
            Back
          </Button>
        </Box>

        {loading && <Typography textAlign="center">Loading...</Typography>}
        {error && (
          <Typography color="error" textAlign="center">
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={3}>
                <InventoryStatus teamName={teamName || teamId!} totals={totals} />
                <InventoryReviewed
                  percentReviewed={percentReviewed}
                  items={items}
                  timeMode={timeMode}
                  selectedValue={selectedValue}
                  onChangeTimeMode={setTimeMode}
                  onChangeValue={setSelectedValue}
                />

                <FollowUpsTable followUps={dashboardData?.followUps ?? []} />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={3}>
                <AddInventoryCard teamId={teamId!} />
                <RestartInventoryProcess teamId={teamId!} />
                <TeamActivityChart teamStats={teamStats} />
              </Stack>
            </Grid>
          </Grid>
        )}
      </Box>

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
