import { Paper, Typography, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

interface FollowUpsTableProps {
  followUps: Array<{
    itemId: string;
    name: string;
    status: string;
    updatedAt: string;
    notes: string;
    parent: string;
  }>;
}

export default function FollowUpsTable({ followUps }: FollowUpsTableProps) {
  const theme = useTheme();
  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: theme.palette.background.paper,
        border: cardBorder,
      }}
    >
      <Typography variant="h6" fontWeight={800} mb={2}>
        Follow-Ups
      </Typography>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            padding: '6px 8px',
            borderBottom: `1px solid ${theme.palette.divider}`,
            textAlign: 'left',
          },
          '& th': {
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            fontWeight: 700,
          },
        }}
      >
        <thead>
          <tr>
            <th>Item</th>
            <th>Kit</th>
            <th>Status</th>
            <th>Reviewed On</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {followUps.length > 0 ? (
            followUps.map((item) => (
              <tr key={item.itemId}>
                <td>{item.name}</td>
                <td>{item.parent ?? 'N/A'}</td>
                <td>{item.status}</td>
                <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}</td>
                <td>{item.notes}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center' }}>
                No follow-ups
              </td>
            </tr>
          )}
        </tbody>
      </Box>
    </Paper>
  );
}
