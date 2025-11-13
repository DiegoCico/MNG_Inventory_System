import { Paper, Typography, Grid, Card } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface InventoryStatusProps {
  teamId: string;
  totals: {
    toReview: number;
    completed: number;
    shortages: number;
    damaged: number;
  };
}

export default function InventoryStatus({ teamId, totals }: InventoryStatusProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  const items = [
    { title: "To Review", value: totals.toReview },
    { title: "Completed", value: totals.completed },
    { title: "Shortages", value: totals.shortages },
    { title: "Damaged", value: totals.damaged },
  ];

  return (
    <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
      <Typography variant="h6" fontWeight={800} mb={2}>
        {teamId}'s Inventory Status
      </Typography>
      <Grid container spacing={2}>
        {items.map((item, i) => (
          <Grid key={i} size={{xs:6, sm:6, md:3}}>
            <Card
              elevation={0}
              sx={{
                p: 3,
                textAlign: "center",
                border: cardBorder,
                bgcolor: theme.palette.background.paper,
              }}
            >
              <Typography variant="subtitle2">{item.title}</Typography>
              <Typography variant="h4" fontWeight={800}>
                {item.value}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
