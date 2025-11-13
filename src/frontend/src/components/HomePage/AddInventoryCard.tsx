import { Paper, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

interface AddInventoryCardProps {
  teamId: string;
}

export default function AddInventoryCard({ teamId }: AddInventoryCardProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: theme.palette.background.paper,
        border: cardBorder,
        textAlign: "center",
      }}
    >
      <Typography variant="h6" fontWeight={800} mb={2}>
        Add Inventory
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Register new inventory items to be reviewed
      </Typography>
      <Button
        variant="contained"
        fullWidth
        color="primary"
        component={Link}
        to={`/teams/${teamId}/items/new`}
      >
        Add New Inventory Item
      </Button>
    </Paper>
  );
}
