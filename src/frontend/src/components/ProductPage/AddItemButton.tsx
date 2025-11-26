import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';

interface AddItemButtonProps {
  parentId: string | number;
  level?: number;
  teamId?: string; // Optional teamId prop
}

export default function AddItemButton({ parentId, level = 0, teamId: teamIdProp }: AddItemButtonProps) {
  const navigate = useNavigate();
  const { teamId: teamIdParam } = useParams<{ teamId: string }>();
  const theme = useTheme();

  // Use provided teamId or fall back to params
  const teamId = teamIdProp || teamIdParam;

  const handleClick = () => {
    if (!teamId) {
      console.error('No teamId available for navigation');
      return;
    }

    navigate(`/teams/${teamId}/items/new`, {
      state: { parentId: parentId },
    });
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        bgcolor: alpha(theme.palette.primary.main, 0.02),
        border: '2px dashed',
        borderColor: alpha(theme.palette.primary.main, 0.3),
        borderRadius: 1,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        ml: level * 2,
        mb: 1,
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          borderColor: theme.palette.primary.main,
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          flexShrink: 0,
        }}
      >
        <AddIcon
          sx={{
            fontSize: 24,
            color: theme.palette.primary.main,
          }}
        />
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: theme.palette.primary.main,
        }}
      >
        Add New Item
      </Typography>
    </Card>
  );
}
