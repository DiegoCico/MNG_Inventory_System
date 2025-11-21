// components/EmptyState.tsx
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface EmptyStateProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
}

export default function EmptyState({ loading, error, isEmpty }: EmptyStateProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <Box textAlign="center" mt={6}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: theme.palette.text.secondary }}>
          Loading your teams...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={6}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box textAlign="center" mt={6}>
        <Typography>No teams found</Typography>
      </Box>
    );
  }

  return null;
}
