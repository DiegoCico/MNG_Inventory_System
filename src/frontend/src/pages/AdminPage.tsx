import React, { useState } from 'react';
import { Box, Container, Tabs, Tab, Paper, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TopBar from '../components/TopBar';
import RoleManagementTab from '../components/admin/RoleManagementTab';
import UserRoleAssignmentTab from '../components/admin/UserRoleAssignmentTab';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} />

      <Box sx={{ m: 4 }}>
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
      <Container maxWidth="lg" sx={{ pb: 4 }}>
        <Paper
          elevation={2}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: theme.palette.background.paper,
              px: 2,
            }}
          >
            <Tab label="Roles" />
            <Tab label="User Assignments" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {activeTab === 0 && <RoleManagementTab />}
            {activeTab === 1 && <UserRoleAssignmentTab />}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
