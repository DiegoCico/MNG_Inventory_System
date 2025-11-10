/* eslint-disable @typescript-eslint/no-explicit-any */
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
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
import { loadDashboard } from "../api/home";

export default function HomePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const name = "Ben Tran";
  const email = "tran.b@northeastern.edu";
  const team = "MNG INVENTORY";
  const permissions = "Admin";

  // 🟩 Load dashboard data
  useEffect(() => {
    async function getDashboardData(): Promise<void> {
      if (!teamId) {
        console.log("teamId is undefined");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await loadDashboard(teamId);
        console.log("📋 Loaded dashboard:", data);
        setDashboardData(data.overview);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load dashboard data";
        setError(message);
        console.error(message);
      } finally {
        setLoading(false);
      }
    }
    getDashboardData();
  }, [teamId]);

  const handleProfileImageChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        setProfileImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // 🟩 derived values
  const totals = dashboardData?.totals || {
    toReview: 0,
    completed: 0,
    shortages: 0,
    damaged: 0,
  };
  const percentReviewed = dashboardData?.percentReviewed || 0;
  const teamStats = dashboardData?.teamStats || [];

  const reviewData = [
    { hour: "1h ago", reviewed: 3 },
    { hour: "2h ago", reviewed: 4 },
    { hour: "3h ago", reviewed: 1 },
    { hour: "4h ago", reviewed: 5 },
    { hour: "5h ago", reviewed: 2 },
  ];

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
        profileImage={profileImage}
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

                    <Typography variant="h6" fontWeight={800}>
                      {team}'s Inventory Status
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

                {/* 🟩 Follow-Ups Table (restored) */}
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
                  <List dense>
                    <ListItem disableGutters>
                      <ListItemText primary="Camera Kit missing charger — assigned to Dana (10/28/25)" />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText primary="Speaker cable damage — pending review (10/26/25)" />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText primary="Projector bulb replacement — completed (10/25/25)" />
                    </ListItem>
                  </List>
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
                <RestartProcess />

                {/* Recent Notes */}
                <Paper
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
                </Paper>

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
        profileImage={profileImage}
        onProfileImageChange={handleProfileImageChange}
        name={name}
        email={email}
        team={team}
        permissions={permissions}
      />

      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
