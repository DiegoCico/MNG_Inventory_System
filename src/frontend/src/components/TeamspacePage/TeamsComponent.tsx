import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  CircularProgress,
  Box,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface TeamIconProps {
  id: string;
  name: string;
  description?: string;
  percent?: number;
  onInvite?: (teamName: string) => void;
  onRemove?: (teamName: string) => void;
  onDelete?: (teamName: string) => void;
  onViewMembers?: (teamId: string, teamName: string) => void;
}

export default function TeamIcon({
  id,
  name,
  description,
  percent = 0,
  onInvite,
  onRemove,
  onDelete,
  onViewMembers,
}: TeamIconProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);
  const handleOpenTeam = () => navigate(`/teams/home/${id}`);

  const borderColor = alpha(theme.palette.text.primary, 0.1);

  function getColor(p: number) {
    const clamp = Math.max(0, Math.min(100, p));

    if (clamp <= 50) {
      const t = clamp / 50;
      const r = Math.round(211 + (251 - 211) * t);
      const g = Math.round(47 + (192 - 47) * t);
      const b = Math.round(47 + (45 - 47) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }

    const t = (clamp - 50) / 50;
    const r = Math.round(251 + (56 - 251) * t);
    const g = Math.round(192 + (142 - 192) * t);
    const b = Math.round(45 + (60 - 45) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const ringColor = getColor(percent);

  return (
    <>
      <Card
        sx={{
          position: 'relative',
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'all 0.25s ease',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: theme.palette.primary.main,
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
          p: { xs: 1.2, sm: 2 },
          width: '100%',
        }}
      >
        <CardActionArea
          onClick={handleOpenTeam}
          sx={{
            borderRadius: 3,
            width: '100%',
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2.2 } }}>
            <Stack alignItems="center" spacing={1.8} sx={{ textAlign: 'center' }}>

              {/* ===== CLEAN PROGRESS RING ===== */}
              <Box sx={{ position: 'relative', width: 72, height: 72 }}>

                {/* Always show faint outline */}
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={72}
                  thickness={4}
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.15),
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                />

                {/* Main colored ring */}
                <CircularProgress
                  variant="determinate"
                  value={percent}
                  size={72}
                  thickness={4}
                  sx={{
                    color: ringColor,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />

                {/* % IN MIDDLE */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    fontSize={16}
                    fontWeight={800}
                    sx={{ color: theme.palette.text.primary }}
                  >
                    {percent}%
                  </Typography>
                </Box>
              </Box>

              {/* NAME */}
              <Tooltip title={name}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.text.primary,
                    maxWidth: 180,
                    fontSize: { xs: 14, sm: 16 },
                  }}
                  noWrap
                >
                  {name}
                </Typography>
              </Tooltip>

              {/* DESCRIPTION */}
              <Tooltip title={description || 'No description'}>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: { xs: 12.5, sm: 13 },
                    maxWidth: 200,
                  }}
                  noWrap
                >
                  {description || 'No description'}
                </Typography>
              </Tooltip>
            </Stack>
          </CardContent>
        </CardActionArea>

        {/* MENU BTN */}
        <IconButton
          size="small"
          onClick={handleMenu}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            color: theme.palette.text.secondary,
            '&:hover': { color: theme.palette.primary.main },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Card>

      {/* MENU */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { handleClose(); handleOpenTeam(); }}>Open</MenuItem>
        <MenuItem onClick={() => { handleClose(); onViewMembers?.(id, name); }}>View Members</MenuItem>
        <MenuItem onClick={() => { handleClose(); onInvite?.(name); }}>Invite Member</MenuItem>

        <Divider />

        <MenuItem sx={{ color: 'error.main' }} onClick={() => { handleClose(); onRemove?.(name); }}>
          Remove Member
        </MenuItem>

        <MenuItem sx={{ color: 'error.main' }} onClick={() => { handleClose(); onDelete?.(name); }}>
          Delete Teamspace
        </MenuItem>
      </Menu>
    </>
  );
}
