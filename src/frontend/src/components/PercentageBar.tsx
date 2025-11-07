import { Box, Typography } from '@mui/material';

function PercentageBar() {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: 'primary.dark',
        p: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Typography variant="h5" fontWeight="bold" color="primary.contrastText">
        27%
      </Typography>
      <Typography variant="caption" color="primary.contrastText">
        Platoon 1, Team 2
      </Typography>
    </Box>
  );
}

export default PercentageBar;
