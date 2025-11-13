import {
  Paper,
  Typography,
  Stack,
  Box,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import CircularProgressBar from "../CircularProgressBar";

interface InventoryReviewedProps {
  percentReviewed: number;
  reviewData: Array<{ hour: string; reviewed: number }>;
}

export default function InventoryReviewed({ percentReviewed, reviewData }: InventoryReviewedProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
      <Typography variant="h6" fontWeight={800} mb={2}>
        Inventory Reviewed
      </Typography>
      <Stack direction="row" alignItems="center" spacing={3} sx={{ flexWrap: "wrap" }}>
        <CircularProgressBar value={percentReviewed} />
        <Box sx={{ flex: 1, minHeight: 180, minWidth: { xs: 180, sm: 200 } }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            Reviews in Last 5 Hours
          </Typography>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={reviewData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis
                dataKey="hour"
                tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: cardBorder,
                  borderRadius: 6,
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 700,
                }}
                itemStyle={{ color: theme.palette.text.primary }}
              />
              <Bar dataKey="reviewed" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
          <Typography variant="caption" sx={{ mt: 1, display: "block", textAlign: "right" }}>
            Last updated 1 hr ago
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
