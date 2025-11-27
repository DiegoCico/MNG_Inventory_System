import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

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
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningAmberIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight="bold">
          Damage Reports
        </Typography>
      </Box>

      {damageReports.length === 0 ? (
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.error.main, 0.05),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            borderRadius: 2,
            mb: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No damage reports yet
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {damageReports.map((report, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.5,
                bgcolor: alpha(theme.palette.error.main, 0.05),
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.08),
                },
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  wordBreak: 'break-word',
                  color: theme.palette.text.primary,
                }}
              >
                {report}
              </Typography>
              {isEditMode && (
                <IconButton
                  size="small"
                  onClick={() => handleDelete(i)}
                  sx={{
                    color: theme.palette.error.main,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {isEditMode && (
        <Stack direction="row" spacing={1} alignItems="flex-start">
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
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.background.paper,
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!current.trim()}
            sx={{
              minWidth: 'auto',
              px: 2,
              flexShrink: 0,
            }}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </Stack>
      )}
    </Box>
  );
}
