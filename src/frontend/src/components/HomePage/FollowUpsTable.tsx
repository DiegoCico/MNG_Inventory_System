import { Paper, Typography, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useParams } from 'react-router-dom';

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
  const navigate = useNavigate();
  const { teamId } = useParams();

  const handleRowClick = (itemId: string) => {
    if (teamId) {
      navigate(`/teams/${teamId}/items/${itemId}`);
    }
  };

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
              <tr
                key={item.itemId}
                onClick={() => handleRowClick(item.itemId)}
                style={{ cursor: 'pointer' }} // pointer cursor
                // hover effect using inline sx with MUI `alpha` for subtle background
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = alpha(theme.palette.primary.main, 0.08))
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
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
