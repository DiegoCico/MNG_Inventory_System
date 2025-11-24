import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  Fade,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function DamageReportsSection({
                                               damageReports,
                                               setDamageReports,
                                               isEditMode,
                                             }: {
  damageReports: string[];
  setDamageReports: (r: string[]) => void;
  isEditMode?: boolean;
}) {
  const theme = useTheme();
  const [current, setCurrent] = useState('');

  const handleAdd = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    setDamageReports([...damageReports, trimmed]);
    setCurrent('');
  };

  const handleDelete = (index: number) => {
    const updated = damageReports.filter((_, i) => i !== index);
    setDamageReports(updated);
  };

  return (
    <Fade in>
      <Box
        sx={{
          mt: 2,
          p: 2,
          bgcolor:
            theme.palette.mode === 'light'
              ? alpha(theme.palette.warning.light, 0.5)
              : alpha(theme.palette.warning.dark, 0.3),
          borderRadius: 2,
          border: `1px solid ${
            theme.palette.mode === 'light'
              ? theme.palette.warning.main
              : alpha(theme.palette.warning.main, 0.5)
          }`,
          width: '100%',
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Damage Reports
        </Typography>

        {damageReports.length === 0 ? (
          <Alert
            icon={<InfoOutlinedIcon fontSize="small" />}
            severity="info"
            sx={{
              bgcolor:
                theme.palette.mode === 'light'
                  ? alpha(theme.palette.info.light, 0.3)
                  : alpha(theme.palette.info.dark, 0.3),
              color: theme.palette.info.main,
              borderRadius: 2,
              mb: 1.5,
            }}
          >
            No damage reports yet.
          </Alert>
        ) : (
          <List dense sx={{ mb: 1.5, py: 0 }}>
            {damageReports.map((report, i) => (
              <ListItem
                key={i}
                sx={{
                  bgcolor:
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.warning.light, 0.3)
                      : alpha(theme.palette.warning.dark, 0.3),
                  border: `1px solid ${theme.palette.warning.main}`,
                  borderRadius: 1,
                  mb: 1,
                  '&:last-child': { mb: 0 },
                }}
              >
                <ListItemText
                  primary={report}
                  primaryTypographyProps={{
                    sx: { wordBreak: 'break-word', pr: 5 }
                  }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDelete(i)}
                    sx={{ color: theme.palette.warning.dark }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        {isEditMode && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Describe damage..."
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              sx={{
                bgcolor:
                  theme.palette.mode === 'light'
                    ? theme.palette.background.paper
                    : theme.palette.background.default,
              }}
            />
            <Tooltip title="Add Report">
              <IconButton
                color="primary"
                onClick={handleAdd}
                sx={{
                  bgcolor: theme.palette.primary.main,
                  color: theme.palette.getContrastText(theme.palette.primary.main),
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                  flexShrink: 0,
                }}
              >
                <AddCircleIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Fade>
  );
}
