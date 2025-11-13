/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import TopBar from "../components/TopBar";
import NavBar from "../components/NavBar";
import Profile from "../components/Profile";

import InventoryStatus from "../components/HomePage/InventoryStatus";
import InventoryReviewed from "../components/HomePage/InventoryReviewed";
import FollowUpsTable from "../components/HomePage/FollowUpsTable";
import AddInventoryCard from "../components/HomePage/AddInventoryCard";
import RestartInventoryProcess from "../components/HomePage/RestartInventoryCard";
import TeamActivityChart from "../components/HomePage/TeamActivityChart";

import { getItems } from "../api/items";

export default function HomePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // use getItems function and summarize a subset of data to populate the different dashboard components
      const result = await getItems(teamId);

      if (!result.success || !result.items) {
        setError(result.error || 'Failed to fetch items');
        return;
      }

      const items = Array.isArray(result.items) ? result.items : [];

      // define dashboard constants
      const totals = { toReview: 0, completed: 0, shortages: 0, damaged: 0 };
      const users: Record<string, { completed: number; shortages: number; damaged: number }> = {};
      const now = new Date();
      // TODO: fix HOURS_BACK to integrate different time periods
      const HOURS_BACK = 5;
      const hourlyCounts = Array(HOURS_BACK).fill(0);
      const hourlyLabels = Array(HOURS_BACK)
        .fill(0)
        .map((_, i) => `${HOURS_BACK - i}h ago`);
      const followUps: Array<{
        itemId: string;
        name: string;
        status: string;
        updatedAt: string;
        createdBy: string;
        notes: string;
        parent: string;
      }> = [];
      for (const item of items) {
        const status = (item.status ?? 'To Review').toLowerCase();
        const createdBy = item.createdBy ?? 'unknown';
        const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;

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

        // Inventory Reviewed statistics
        if (updatedAt) {
          const diffHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
          if (diffHours <= HOURS_BACK) {
            const bucket = Math.floor(HOURS_BACK - diffHours);
            if (bucket >= 0 && bucket < HOURS_BACK) {
              hourlyCounts[bucket]++;
            }
          }
        }

        // Follow-Ups statistics
        if (status === 'damaged' || status === 'shortages') {
          followUps.push({
            itemId: item.itemId,
            name: item.name,
            status,
            parent: item.parent ?? 'N/A',
            notes: item.notes ?? '',
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
        lastXHoursHistogram: {
          labels: hourlyLabels,
          counts: hourlyCounts,
        },
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
}, [teamId]);

  const totals = dashboardData?.totals || { toReview: 0, completed: 0, shortages: 0, damaged: 0 };
  const percentReviewed = dashboardData?.percentReviewed || 0;
  const teamStats = dashboardData?.teamStats || [];
  const reviewData = dashboardData?.lastXHoursHistogram
    ? dashboardData.lastXHoursHistogram.labels.map((label: string, i: number) => ({
        hour: label,
        reviewed: dashboardData.lastXHoursHistogram.counts[i] ?? 0,
      }))
    : [];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar isLoggedIn onProfileClick={() => setProfileOpen(true)} />
      <Box sx={{ flex: 1, p: 4 }}>
        <Box mb={3}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/teams")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: theme.palette.text.primary,
              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) },
            }}
          >
            Back
          </Button>
        </Box>

        {loading && <Typography textAlign="center">Loading...</Typography>}
        {error && <Typography color="error" textAlign="center">{error}</Typography>}

        {!loading && !error && (
          <Grid container spacing={3}>
            <Grid size={{xs:12, md:8}}>
              <Stack spacing={3}>
                <InventoryStatus teamId={teamId!} totals={totals} />
                <InventoryReviewed percentReviewed={percentReviewed} reviewData={reviewData} />
                <FollowUpsTable followUps={dashboardData?.followUps ?? []} />
              </Stack>
            </Grid>

            <Grid size={{xs:12, md:4}}>
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
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
