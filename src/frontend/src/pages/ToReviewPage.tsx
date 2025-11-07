/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../components/ItemListComponent';
import NavBar from '../components/NavBar';
import PercentageBar from '../components/PercentageBar';
import { getItems } from '../api/items';

export default function ToReviewPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [items, setItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIncompleteItems = async () => {
      if (!teamId) {
        setError('Missing team ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getItems(teamId);

        if (result.success && result.items) {
          // Filter for only Incomplete status items
          const incompleteItems = result.items
            .filter((item: any) => item.status === 'Incomplete')
            .map((item: any) => ({
              id: item.itemId,
              productName: item.name,
              actualName: item.actualName || item.name,
              subtitle: item.description || 'No description',
              image: item.imageLink || 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400',
              date: new Date(item.createdAt).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: '2-digit'
              }),
              teamId: item.teamId
            }));

          setItems(incompleteItems);
        } else {
          setError(result.error || 'Failed to fetch items');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch items');
      } finally {
        setLoading(false);
      }
    };

    fetchIncompleteItems();
  }, [teamId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <PercentageBar />
      <Box sx={{ width: '100%', bgcolor: '#e8e8e8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
          <Container maxWidth="md">
            <Typography
              variant="h5"
              sx={{
                fontWeight: 550,
                color: '#333',
                fontSize: { xs: '1.25rem', sm: '1.5rem' }
              }}
            >
              Inventory To Review ({items.length})
            </Typography>
          </Container>
        </Box>

        {/* Content */}
        <Container maxWidth="md" disableGutters>
          <Box sx={{ p: 2, pb: 10 }}>
            {error ? (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            ) : items.length === 0 ? (
              <Alert severity="info">No items to review. All items are complete!</Alert>
            ) : (
              <ItemListComponent items={items} />
            )}
          </Box>
        </Container>
      </Box>
      <NavBar />
    </div>
  );
}

