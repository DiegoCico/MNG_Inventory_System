/* eslint-disable @typescript-eslint/no-explicit-any */
import { Paper, Typography, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

interface TeamActivityChartProps {
  teamStats: Array<{
    userId: string;
    name: string;
    completed: number;
    shortages: number;
    damaged: number;
  }>;
}

export default function TeamActivityChart({ teamStats }: TeamActivityChartProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  // Custom shape component for rounded top bars
  const RoundedBar = (props: any) => {
    const { fill, x, y, width, height, isTopBar } = props;
    
    if (!isTopBar || height <= 0) {
      // Regular rectangle for non-top bars
      return <rect x={x} y={y} width={width} height={height} fill={fill} />;
    }

    // Rounded rectangle for top bar
    const radius = 4;
    const path = `
      M ${x},${y + radius}
      Q ${x},${y} ${x + radius},${y}
      L ${x + width - radius},${y}
      Q ${x + width},${y} ${x + width},${y + radius}
      L ${x + width},${y + height}
      L ${x},${y + height}
      Z
    `;
    
    return <path d={path} fill={fill} />;
  };

  return (
    <Paper elevation={0} sx={{ p: 3, bgcolor: theme.palette.background.paper, border: cardBorder }}>
      <Typography variant="h6" fontWeight={800} mb={2}>
        Team Activity
      </Typography>
      <Box sx={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={teamStats.map((t) => ({
              name: t.name,
              completed: t.completed,
              shortages: t.shortages,
              damaged: t.damaged,
            }))}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey="name"
              tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
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
            <Bar
              dataKey="completed"
              stackId="a"
              fill={theme.palette.success.main}
              shape={(props: any) => (
                <RoundedBar 
                  {...props} 
                  isTopBar={props.payload.damaged === 0 && props.payload.shortages === 0}
                />
              )}
            />
            <Bar 
              dataKey="shortages" 
              stackId="a" 
              fill={theme.palette.warning.main}
              shape={(props: any) => (
                <RoundedBar 
                  {...props} 
                  isTopBar={props.payload.damaged === 0 && props.payload.shortages > 0}
                />
              )}
            />
            <Bar 
              dataKey="damaged" 
              stackId="a" 
              fill={theme.palette.error.main}
              shape={(props: any) => (
                <RoundedBar 
                  {...props} 
                  isTopBar={props.payload.damaged > 0}
                />
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}