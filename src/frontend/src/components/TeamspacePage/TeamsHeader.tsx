// components/TeamsHeader.tsx
import { Stack, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';

interface TeamsHeaderProps {
  onCreateTeam: () => void;
  onInviteMember: () => void;
}

export default function TeamsHeader({ onCreateTeam, onInviteMember }: TeamsHeaderProps) {
  const theme = useTheme();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      mb={2.5}
    >
      <Typography variant="h4" sx={{ fontWeight: 900, color: theme.palette.text.primary }}>
        Teamspaces
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="warning"
          component={RouterLink}
          to="/admin"
          startIcon={<AdminPanelSettingsIcon />}
          sx={{ fontWeight: 900, textTransform: 'none' }}
        >
          Admin Portal
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onCreateTeam}
          startIcon={<AddIcon />}
          sx={{ fontWeight: 900, textTransform: 'none' }}
        >
          Create Team
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onInviteMember}
          startIcon={<GroupAddIcon />}
          sx={{ fontWeight: 900, textTransform: 'none' }}
        >
          Invite Member
        </Button>
      </Stack>
    </Stack>
  );
}
