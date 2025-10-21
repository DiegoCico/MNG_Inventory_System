// src/components/TeamsComponent.tsx
import {
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  Stack,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface TeamIconProps {
  id: string;
  name: string;
  role?: string; // e.g., STUDENT, ADMIN
  iconUrl?: string;
}

export default function TeamIcon({ id, name, role, iconUrl }: TeamIconProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event: MouseEvent<HTMLButtonElement>) => {
    // avoid also triggering card click
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleOpenTeam = () => navigate(`/teams/${id}`);

  // Palette tokens matching your Hero
  const blue = '#283996';
  const cardBg = '#FFFFFF';
  const borderColor = alpha('#000', 0.08);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          bgcolor: cardBg,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            borderColor: alpha(blue, 0.35),
          },
          // keyboard focus ring
          '&:focus-within': {
            outline: `2px solid ${alpha(blue, 0.5)}`,
            outlineOffset: 2,
          },
        }}
      >
        <CardActionArea
          onClick={handleOpenTeam}
          sx={{
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ p: 2.25 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar
                src={iconUrl}
                variant="rounded"
                sx={{
                  width: 48,
                  height: 48,
                  fontWeight: 800,
                  borderRadius: 1.25,
                  bgcolor: alpha(blue, 0.12),
                  color: blue,
                }}
              >
                {getInitials(name)}
              </Avatar>

              <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  noWrap
                  sx={{ fontWeight: 700, lineHeight: 1.25, color: '#1F1F1F' }}
                >
                  {name}
                </Typography>

                {role && (
                  <Chip
                    label={role.toUpperCase()}
                    size="small"
                    variant="filled"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      bgcolor: alpha('#1F1F1F', 0.06),
                      color:
                        theme.palette.mode === 'dark'
                          ? theme.palette.grey[200]
                          : '#1F1F1F',
                    }}
                  />
                )}
              </Stack>

              <IconButton
                size="small"
                onClick={handleMenu}
                aria-label="team options"
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.text.primary },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              border: `1px solid ${borderColor}`,
              boxShadow: '0 6px 20px rgba(0,0,0,0.16)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleClose();
            navigate(`/teams/${id}`);
          }}
        >
          Open
        </MenuItem>
        <MenuItem onClick={handleClose}>Rename</MenuItem>
        <MenuItem onClick={handleClose}>Leave Team</MenuItem>
      </Menu>
    </>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
