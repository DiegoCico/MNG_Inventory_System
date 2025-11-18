// components/TeamsSearch.tsx
import { Stack, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface TeamsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TeamsSearch({ value, onChange }: TeamsSearchProps) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      sx={{
        mb: 3,
        bgcolor: theme.palette.background.paper,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <TextField
        label="Search Teams"
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Stack>
  );
}