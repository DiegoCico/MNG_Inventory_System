import React, { useState } from "react";
import Grid from "@mui/material/Grid";
import { useTheme, alpha } from "@mui/material/styles";
import { Link, useParams } from "react-router-dom";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import SecurityIcon from "@mui/icons-material/Security";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { IconButton, Avatar } from "@mui/material";
import CircularProgressBar from "../components/CircularProgressBar";
import NavBar from "../components/NavBar";
import RestartProcess from "../components/RestartProcess";
import Profile from "../components/Profile";
import {
  AppBar,
  Box,
  Button,
  Card,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
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

export default function HomePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const tasksCompleted = 30;
  const cardBorder = `1px solid ${theme.palette.divider}`;

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

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

  console.log("Team Id", teamId);

  const reviewData = [
    { hour: "1h ago", reviewed: 3 },
    { hour: "2h ago", reviewed: 4 },
    { hour: "3h ago", reviewed: 1 },
    { hour: "4h ago", reviewed: 5 },
    { hour: "5h ago", reviewed: 2 },
  ];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
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

        
          <IconButton
            size="large"
            sx={{
              color: theme.palette.primary.contrastText,
              "&:hover": {
                bgcolor: theme.palette.primary.dark,
              },
            }}
            onClick={() => setProfileOpen(true)}
          >
            {profileImage ? (
              <Avatar src={profileImage} alt="Profile" />
            ) : (
              <AccountCircleIcon fontSize="large" />
            )}
          </IconButton>


        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          bgcolor: theme.palette.background.default,
          p: { xs: 2, sm: 3, md: 4 },
          color: theme.palette.text.primary,
          pb: { xs: 12, sm: 14 }, // extra padding for fixed bottom nav
        }}
      >
        <Grid container spacing={3}>
          {/* Left side */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              {/* Inventory Status */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  MNG Inventory's Inventory Status
                </Typography>
                <Grid container spacing={2}>
                  {[
                    { title: "To Review", value: "70" },
                    { title: "Completed", value: "25" },
                    { title: "Shortages", value: "3" },
                    { title: "Damaged", value: "2" },
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
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="h4" fontWeight={800}>
                          {item.value}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Inventory Reviewed */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Inventory Reviewed
                </Typography>
                <Stack
                  direction={{ xs: "row", sm: "row" }}
                  alignItems="center"
                  spacing={3}
                  sx={{ flexWrap: "wrap" }}
                >
                  {/* Circular Progress */}
                  <CircularProgressBar value={tasksCompleted} />

                  {/* Reviews in Last 5 Hours */}
                  <Box sx={{ flex: 1, minHeight: 180, minWidth: { xs: 180, sm: 200 } }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                      Reviews in Last 5 Hours
                    </Typography>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={reviewData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                        />
                        <Tooltip
                          cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: cardBorder,
                            borderRadius: 6,
                          }}
                          labelStyle={{ color: theme.palette.text.primary, fontWeight: 700 }}
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
                    <Typography variant="caption" sx={{ mt: 1, display: "block", textAlign: "right" }}>
                      Last updated 1 hr ago
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Follow-Ups */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Follow-Ups
                </Typography>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.9rem" },
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
                    <tr>
                      <td>Bandages</td>
                      <td>First Aid Kit</td>
                      <td>Shortages</td>
                      <td>10/19/25</td>
                      <td>Missing one stack from kit</td>
                    </tr>
                    <tr>
                      <td>Robot</td>
                      <td>Robot</td>
                      <td>Damaged</td>
                      <td>10/18/25</td>
                      <td>Dent in the right side, sent to maintenance</td>
                    </tr>
                  </tbody>
                </Box>
              </Paper>
            </Stack>
          </Grid>

          {/* Right side */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              {/* Recent Notes */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
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

              {/* Team Activity */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Team Activity
                </Typography>
                <Box sx={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Charlie", completed: 2, shortages: 1, damaged: 0 },
                        { name: "Dana", completed: 3, shortages: 0, damaged: 1 },
                        { name: "Alice", completed: 1, shortages: 1, damaged: 0 },
                        { name: "Bob", completed: 2, shortages: 0, damaged: 0 },
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: cardBorder,
                          borderRadius: 6,
                        }}
                        labelStyle={{ color: theme.palette.text.primary, fontWeight: 700 }}
                        itemStyle={{ color: theme.palette.text.primary }}
                      />
                      <Bar dataKey="completed" stackId="a" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shortages" stackId="a" fill={theme.palette.warning.main} />
                      <Bar dataKey="damaged" stackId="a" fill={theme.palette.error.main} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                <Stack direction="row" justifyContent="center" spacing={3} sx={{ mt: 2, flexWrap: "wrap" }}>
                  {[
                    { label: "Completed", color: theme.palette.success.main },
                    { label: "Shortages", color: theme.palette.warning.main },
                    { label: "Damaged", color: theme.palette.error.main },
                  ].map((item, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 16, height: 16, bgcolor: item.color, borderRadius: 0.5 }} />
                      <Typography variant="body2">{item.label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>

              {/* Add Inventory */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder, textAlign: "center" }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Add Inventory
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Register new inventory items to be reviewed
                </Typography>
                <Button variant="contained" fullWidth color="primary">
                  Add New Inventory Item
                </Button>
              </Paper>

              {/* Restart Inventory Process */}
              <RestartProcess />
            </Stack>
          </Grid>
        </Grid>
      </Box>

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

      {/* Fixed Bottom Nav */}
      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
