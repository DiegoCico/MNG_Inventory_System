/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../components/ItemListComponent';
import NavBar from '../components/NavBar';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import { getItems } from '../api/items';

export default function ToReviewPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [items, setItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

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
          const itemsArray = Array.isArray(result.items) ? result.items : [];

          // Build hierarchy from ALL items first
          const buildHierarchy = (flatItems: any[]): ItemListItem[] => {
            const map: Record<string, ItemListItem> = {};
            const roots: ItemListItem[] = [];

            // First pass - create all items
            flatItems.forEach((item: any) => {
              map[item.itemId] = {
                id: item.itemId,
                productName: item.name,
                actualName: item.actualName || item.name,
                subtitle: item.description || 'No description',
                image: item.imageLink && item.imageLink.startsWith('http')
                  ? item.imageLink
                  : 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400',
                date: new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: '2-digit'
                }),
                parent: item.parent,
                status: item.status,
                children: []
              };
            });

            // Second pass - build parent-child relationships
            flatItems.forEach((item: any) => {
              const mappedItem = map[item.itemId];
              if (item.parent && map[item.parent]) {
                map[item.parent].children!.push(mappedItem);
              } else {
                roots.push(mappedItem);
              }
            });

            return roots;
          };

          // Check if item or any descendant has the target status
          const hasStatusInTree = (item: ItemListItem, targetStatus: string): boolean => {
            if (item.status === targetStatus) return true;
            if (item.children) {
              return item.children.some(child => hasStatusInTree(child, targetStatus));
            }
            return false;
          };

          // Build full hierarchy from all items
          const fullHierarchy = buildHierarchy(itemsArray);

          // Filter to only roots that have "To Review" somewhere in their tree
          const incompleteItems = fullHierarchy.filter(item => hasStatusInTree(item, 'To Review'));

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

  const handleProfileImageChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        setProfileImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        isLoggedIn={true}
        profileImage={profileImage}
        onProfileClick={() => setProfileOpen(true)}
      />

      <Box sx={{ flex: 1, width: '100%', bgcolor: '#e8e8e8' }}>
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

      <Profile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
