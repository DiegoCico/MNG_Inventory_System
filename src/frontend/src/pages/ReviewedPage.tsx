/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Tab, Tabs, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../components/ItemListComponent';
import PercentageBar from '../components/PercentageBar';
import NavBar from '../components/NavBar';
import { useTheme } from '@mui/material/styles';
import { getItems } from '../api/items';

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ReviewedPage() {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();

  const [completedItems, setCompletedItems] = useState<ItemListItem[]>([]);
  const [shortagesItems, setShortagesItems] = useState<ItemListItem[]>([]);
  const [damagedItems, setDamagedItems] = useState<ItemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviewedItems = async () => {
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
          const mapItem = (item: any): ItemListItem => ({
            id: item.itemId,
            productName: item.name,
            actualName: item.actualName || item.name,
            subtitle: item.description || 'No description',
            image: item.imageLink || 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400',
            date: new Date(item.createdAt).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: '2-digit'
            })
          });

          // Filter items by status
          const completed = result.items
            .filter((item: any) => item.status === 'Found')
            .map(mapItem);

          const shortages = result.items
            .filter((item: any) => item.status === 'Missing')
            .map(mapItem);

          const damaged = result.items
            .filter((item: any) => item.status === 'Damaged')
            .map(mapItem);

          setCompletedItems(completed);
          setShortagesItems(shortages);
          setDamagedItems(damaged);
        } else {
          setError(result.error || 'Failed to fetch items');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch items');
      } finally {
        setLoading(false);
      }
    };

    fetchReviewedItems();
  }, [teamId]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

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
        {/* Tabs Header - Full Width */}
        <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            aria-label="inventory tabs"
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: theme.palette.text.secondary,
                minWidth: 'auto'
              },
              '& .Mui-selected': {
                color: theme.palette.primary.main
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.primary.main,
                height: 3
              }
            }}
          >
            <Tab label={`Completed (${completedItems.length})`} />
            <Tab label={`Shortages (${shortagesItems.length})`} />
            <Tab label={`Damaged (${damagedItems.length})`} />
          </Tabs>
        </Box>

        {/* Tab Panels - Constrained Width */}
        <Container maxWidth="md" disableGutters>
          <Box sx={{ p: 2, pb: 10 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TabPanel value={selectedTab} index={0}>
              {completedItems.length > 0 ? (
                <ItemListComponent items={completedItems} />
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#999', py: 4 }}>
                  No completed items
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              {shortagesItems.length > 0 ? (
                <ItemListComponent items={shortagesItems} />
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#999', py: 4 }}>
                  No shortages reported
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={2}>
              {damagedItems.length > 0 ? (
                <ItemListComponent items={damagedItems} />
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#999', py: 4 }}>
                  No damaged items
                </Typography>
              )}
            </TabPanel>
          </Box>
        </Container>
      </Box>
      <NavBar />
    </div>
  );
}
