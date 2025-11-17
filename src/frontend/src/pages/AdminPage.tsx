import React, { useState } from 'react';
import { Box, Container, Tabs, Tab, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TopBar from '../components/TopBar';
import RoleManagementTab from '../components/admin/RoleManagementTab';
import UserRoleAssignmentTab from '../components/admin/UserRoleAssignmentTab';

export default function AdminPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
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
