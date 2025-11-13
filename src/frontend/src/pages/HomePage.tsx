/* eslint-disable @typescript-eslint/no-explicit-any */
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import { useTheme, alpha } from "@mui/material/styles";
import { useParams, Link } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import CircularProgressBar from "../components/CircularProgressBar";
import NavBar from "../components/NavBar";
import RestartProcess from "../components/RestartProcess";
import Profile from "../components/Profile";
import TopBar from "../components/TopBar";
//import { loadDashboard } from "../api/home";
import { getItems } from "../api/items";

export default function HomePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  const [profileOpen, setProfileOpen] = useState(false);
  //const [profileImage, setProfileImage] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // // Load dashboard data
  // useEffect(() => {
  //   async function getDashboardData(): Promise<void> {
  //     if (!teamId) {
  //       console.log("teamId is undefined");
  //       return;
  //     }
  //     try {
  //       setLoading(true);
  //       setError(null);
  //       const data = await loadDashboard(teamId);
  //       console.log("📋 Loaded dashboard:", data);
  //       setDashboardData(data.overview);
  //     } catch (err) {
  //       const message =
  //         err instanceof Error ? err.message : "Failed to load dashboard data";
  //       setError(message);
  //       console.error(message);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   getDashboardData();
  // }, [teamId]);

  useEffect(() => {
    const getDashboardData = async (): Promise<void> => {
      if (!teamId) {
        setError("Missing team ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getItems(teamId);

        if (!result.success || !result.items) {
          setError(result.error || "Failed to fetch items");
          return;
        }

        const items = Array.isArray(result.items) ? result.items : [];

        console.log("📋 Sample item from getItems:", items[0]);

        // --- Compute totals & teamStats ---
        const totals = { toReview: 0, completed: 0, shortages: 0, damaged: 0 };
        const users: Record<string, { completed: number; shortages: number; damaged: number }> = {};

        const now = new Date();
        const HOURS_BACK = 5; // last 5 hours
        const hourlyCounts = Array(HOURS_BACK).fill(0); // histogram buckets
        const hourlyLabels = Array(HOURS_BACK)
          .fill(0)
          .map((_, i) => `${HOURS_BACK - i}h ago`); // ["5h ago", "4h ago", ..., "1h ago"]

        const followUps: Array<{ itemId: string; name: string; status: string; updatedAt: string; createdBy: string; notes: string; parent: string }> = [];

        for (const item of items) {
          const status = (item.status ?? "To Review").toLowerCase();
          const createdBy = item.createdBy ?? "unknown";
          const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;

          // Count totals
          switch (status) {
            case "to review":
              totals.toReview++;
              break;
            case "completed":
              totals.completed++;
              break;
            case "shortages":
              totals.shortages++;
              break;
            case "damaged":
              totals.damaged++;
              break;
            default:
              totals.toReview++;
          }

          // Track user stats
          if (!users[createdBy]) users[createdBy] = { completed: 0, shortages: 0, damaged: 0 };
          if (status.includes("completed")) users[createdBy].completed++;
          if (status.startsWith("shortages")) users[createdBy].shortages++;
          if (status === "damaged") users[createdBy].damaged++;

          // --- Histogram: last X hours ---
          if (updatedAt) {
            const diffHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
            if (diffHours <= HOURS_BACK) {
              const bucket = Math.floor(HOURS_BACK - diffHours);
              if (bucket >= 0 && bucket < HOURS_BACK) {
                hourlyCounts[bucket]++;
              }
            }
          }

          // --- Follow-Ups ---
          if (status === "damaged" || status.startsWith("shortage")) {
            followUps.push({
              itemId: item.itemId,
              name: item.name,
              status,
              parent: item.parent ?? "N/A",
              notes: item.notes ?? "",
              updatedAt: item.updatedAt ?? "",
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
            labels: hourlyLabels,   // ["5h ago", "4h ago", ..., "1h ago"]
            counts: hourlyCounts,   // [0, 2, 5, 1, 0]
          },
          followUps, // ready for the table component
        };

        setDashboardData(overview);
        console.log("📋 Dashboard overview with histogram and follow-ups:", overview);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getDashboardData();
  }, [teamId]);

  
  // 🟩 derived values
  const totals = dashboardData?.totals || {
    toReview: 0,
    completed: 0,
    shortages: 0,
    damaged: 0,
  };
  const percentReviewed = dashboardData?.percentReviewed || 0;
  const teamStats = dashboardData?.teamStats || [];

  // const reviewData = [
  //   { hour: "1h ago", reviewed: 3 },
  //   { hour: "2h ago", reviewed: 4 },
  //   { hour: "3h ago", reviewed: 1 },
  //   { hour: "4h ago", reviewed: 5 },
  //   { hour: "5h ago", reviewed: 2 },
  // ];

  const reviewData = dashboardData?.lastXHoursHistogram
  ? dashboardData.lastXHoursHistogram.labels.map((label: string, i: number) => ({
      hour: label,
      reviewed: dashboardData.lastXHoursHistogram.counts[i] ?? 0,
    }))
  : [];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* ✅ Only one TopBar */}
      <TopBar
        isLoggedIn={true}
        onProfileClick={() => setProfileOpen(true)}
      />

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
        {loading && (
          <Typography textAlign="center" sx={{ mt: 4 }}>
            Loading dashboard...
          </Typography>
        )}
        {error && (
          <Typography color="error" textAlign="center" sx={{ mt: 4 }}>
            {error}
          </Typography>
        )}

        {/* Back button row */}
        <Box mb={3} display="flex" justifyContent="flex-start">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/teams")}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: theme.palette.text.primary,
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            Back
          </Button>
        </Box>


        {!loading && !error && (
          <Grid container spacing={3}>
            {/* Left side */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={3}>
                {/* 🟩 Inventory Status */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                  }}
                >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={2}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    {/* <Button
                      startIcon={<ArrowBackIcon />}
                      onClick={() => navigate("/teams")}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      Back
                    </Button> */}
                    {/* Need to connect name */}
                    <Typography variant="h6" fontWeight={800}>
                      {teamId}'s Inventory Status
                    </Typography>
                  </Stack>
                </Stack>

                  <Grid container spacing={2}>
                    {[
                      { title: "To Review", value: totals.toReview },
                      { title: "Completed", value: totals.completed },
                      { title: "Shortages", value: totals.shortages },
                      { title: "Damaged", value: totals.damaged },
                    ].map((item, i) => (
                      <Grid key={i} size={{ xs: 6, sm: 6, md: 3 }}>
                        <Card
                          elevation={0}
                          sx={{
                            p: 3,
                            textAlign: "center",
                            border: cardBorder,
                            bgcolor: theme.palette.background.paper,
                          }}
                        >
                          <Typography variant="subtitle2">
                            {item.title}
                          </Typography>
                          <Typography variant="h4" fontWeight={800}>
                            {item.value}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                {/* 🟩 Inventory Reviewed */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Inventory Reviewed
                  </Typography>
                  <Stack
                    direction={{ xs: "row", sm: "row" }}
                    alignItems="center"
                    spacing={3}
                    sx={{ flexWrap: "wrap" }}
                  >
                    <CircularProgressBar value={percentReviewed} />
                    <Box
                      sx={{
                        flex: 1,
                        minHeight: 180,
                        minWidth: { xs: 180, sm: 200 },
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, fontWeight: 700 }}
                      >
                        Reviews in Last 5 Hours
                      </Typography>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart
                          data={reviewData}
                          margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={theme.palette.divider}
                          />
                          <XAxis
                            dataKey="hour"
                            tick={{
                              fill: theme.palette.text.primary,
                              fontSize: 12,
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{
                              fill: theme.palette.text.primary,
                              fontSize: 12,
                            }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                          />
                          <Tooltip
                            cursor={{
                              fill: alpha(theme.palette.primary.main, 0.05),
                            }}
                            contentStyle={{
                              backgroundColor: theme.palette.background.paper,
                              border: cardBorder,
                              borderRadius: 6,
                            }}
                            labelStyle={{
                              color: theme.palette.text.primary,
                              fontWeight: 700,
                            }}
                            itemStyle={{ color: theme.palette.text.primary }}
                          />
                          <Bar
                            dataKey="reviewed"
                            fill={theme.palette.primary.main}
                            radius={[4, 4, 0, 0]}
                            barSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      <Typography
                        variant="caption"
                        sx={{ mt: 1, display: "block", textAlign: "right" }}
                      >
                        Last updated 1 hr ago
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
                {/* Follow-Ups */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Follow-Ups
                  </Typography>
                  <Box
                    component="table"
                    sx={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: {
                        xs: "0.75rem",
                        sm: "0.8rem",
                        md: "0.9rem",
                      },
                      "& th, & td": {
                        textAlign: "left",
                        padding: "6px 8px",
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                      },
                      "& th": {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        fontWeight: 700,
                      },
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Kit</th>
                        <th>Status</th>
                        <th>Reviewed On</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.followUps?.length > 0 ? (
                        dashboardData.followUps.map((item: any) => (
                          <tr key={item.itemId}>
                            <td>{item.name}</td>
                            <td>{item.parent ?? "N/A"}</td>
                            <td>{item.status}</td>
                            <td>
                              {item.updatedAt
                                ? new Date(item.updatedAt).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td>{item.notes ?? ""}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center" }}>
                            No follow-ups
                          </td>
                        </tr>
                      )}
                    </tbody>

                  </Box>
                </Paper>
              </Stack>
            </Grid>

            {/* Right side */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={3}>
                {/* Add Inventory */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Add Inventory
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Register new inventory items to be reviewed
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    color="primary"
                    component={Link}
                    to={`/teams/${teamId}/items/new`}
                  >
                    Add New Inventory Item
                  </Button>
                </Paper>

                {/* Restart Process */}
                <RestartProcess teamId={teamId!}
                onRestart={() => window.location.reload()} />

                {/* Recent Notes */}
                {/* <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Recent Notes
                  </Typography>
                  <List dense>
                    <ListItem disableGutters>
                      <ListItemText primary="Microphone: Inspected and verified (10/25/25)" />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText primary="Travel Case: All contents present (10/23/25)" />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText primary="Micro USB Cable: Tested and verified (10/21/25)" />
                    </ListItem>
                  </List>
                </Paper> */}

                {/* Team Activity (from API) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: theme.palette.background.paper,
                    border: cardBorder,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={2}>
                    Team Activity
                  </Typography>
                  <Box sx={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={teamStats.map((t: any) => ({
                          name: t.userId,
                          completed: t.completed,
                          shortages: t.shortages,
                          damaged: t.damaged,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke={theme.palette.divider}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: theme.palette.text.primary,
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fill: theme.palette.text.primary,
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          cursor={{
                            fill: alpha(theme.palette.primary.main, 0.05),
                          }}
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: cardBorder,
                            borderRadius: 6,
                          }}
                          labelStyle={{
                            color: theme.palette.text.primary,
                            fontWeight: 700,
                          }}
                          itemStyle={{ color: theme.palette.text.primary }}
                        />
                        <Bar
                          dataKey="completed"
                          stackId="a"
                          fill={theme.palette.success.main}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="shortages"
                          stackId="a"
                          fill={theme.palette.warning.main}
                        />
                        <Bar
                          dataKey="damaged"
                          stackId="a"
                          fill={theme.palette.error.main}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Profile + NavBar */}
      <Profile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
