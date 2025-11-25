/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { Alert, Box, CircularProgress, Container, Tab, Tabs, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../components/ProductPage/ItemListComponent';
import NavBar from '../components/NavBar';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import SearchBar from '../components/ProductPage/SearchBar';
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
  const [searchQuery, setSearchQuery] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileImage] = useState<string | null>(null);

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
          const itemsArray = Array.isArray(result.items) ? result.items : [];

          // Build hierarchy from ALL items
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
                image:
                  item.imageLink && item.imageLink.startsWith('http')
                    ? item.imageLink
                    : 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400',
                date: new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: '2-digit',
                }),
                parent: item.parent,
                status: item.status,
                isKit: item.isKit,
                children: [],
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

          const hasStatusInTree = (item: ItemListItem, targetStatuses: string[]): boolean => {
            const itemStatus = (item.status ?? '').toLowerCase();
            if (targetStatuses.some((s) => s.toLowerCase() === itemStatus)) return true;
            if (item.children) {
              return item.children.some((child) => hasStatusInTree(child, targetStatuses));
            }
            return false;
          };

          const fullHierarchy = buildHierarchy(itemsArray);

          const completed = fullHierarchy.filter((item) =>
            hasStatusInTree(item, ['completed', 'complete', 'found']),
          );
          const shortages = fullHierarchy.filter((item) =>
            hasStatusInTree(item, ['shortage', 'shortages', 'missing']),
          );
          const damaged = fullHierarchy.filter((item) =>
            hasStatusInTree(item, ['damaged', 'in repair']),
          );

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

  // Filter function for search
  const filterItemsBySearch = (items: ItemListItem[], query: string) => {
    if (!query.trim()) {
      return { filteredItems: items, itemsToExpand: new Set<string | number>() };
    }

    const lowerQuery = query.toLowerCase();
    const expandSet = new Set<string | number>();

    const matchesSearch = (item: ItemListItem): boolean => {
      return (
        item.productName.toLowerCase().includes(lowerQuery) ||
        item.actualName.toLowerCase().includes(lowerQuery)
      );
    };

    const filterTree = (item: ItemListItem): ItemListItem | null => {
      const itemMatches = matchesSearch(item);
      let filteredChildren: ItemListItem[] = [];

      if (item.children) {
        filteredChildren = item.children
          .map((child) => filterTree(child))
          .filter((child): child is ItemListItem => child !== null);
      }

      if (itemMatches || filteredChildren.length > 0) {
        if (filteredChildren.length > 0) {
          expandSet.add(item.id);
        }

        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
        };
      }

      return null;
    };

    const filtered = items
      .map((item) => filterTree(item))
      .filter((item): item is ItemListItem => item !== null);

    return { filteredItems: filtered, itemsToExpand: expandSet };
  };

  // Apply search to each category
  const filteredCompleted = useMemo(
    () => filterItemsBySearch(completedItems, searchQuery),
    [completedItems, searchQuery]
  );

  const filteredShortages = useMemo(
    () => filterItemsBySearch(shortagesItems, searchQuery),
    [shortagesItems, searchQuery]
  );

  const filteredDamaged = useMemo(
    () => filterItemsBySearch(damagedItems, searchQuery),
    [damagedItems, searchQuery]
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
      }}
    >
      <TopBar
        isLoggedIn={true}
        profileImage={profileImage}
        onProfileClick={() => setProfileOpen(true)}
      />

      <Box sx={{ flex: 1, width: '100%', bgcolor: theme.palette.background.default }}>
        {/* Tabs Header - Full Width */}
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderBottom: 1,
            borderColor: theme.palette.divider,
          }}
        >
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
                minWidth: 'auto',
              },
              '& .Mui-selected': {
                color: theme.palette.primary.main,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: theme.palette.primary.main,
                height: 3,
              },
            }}
          >
            <Tab label={`Completed`} />
            <Tab label={`Shortages`} />
            <Tab label={`Damaged`} />
          </Tabs>
        </Box>

        {/* Search Bar - Constrained Width */}
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderBottom: 1,
            borderColor: theme.palette.divider,
            py: 1.5,
          }}
        >
          <Container maxWidth="md">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </Container>
        </Box>

        {/* Tab Panels - Constrained Width */}
        <Container maxWidth="md" disableGutters>
          <Box sx={{ p: 2, pb: 10 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TabPanel value={selectedTab} index={0}>
              {filteredCompleted.filteredItems.length > 0 ? (
                <ItemListComponent
                  items={filteredCompleted.filteredItems}
                  initialExpandedItems={filteredCompleted.itemsToExpand}
                />
              ) : (
                <Typography sx={{ textAlign: 'center', color: theme.palette.text.disabled, py: 4 }}>
                  {searchQuery.trim() ? 'No items match your search.' : 'No completed items'}
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              {filteredShortages.filteredItems.length > 0 ? (
                <ItemListComponent
                  items={filteredShortages.filteredItems}
                  initialExpandedItems={filteredShortages.itemsToExpand}
                />
              ) : (
                <Typography sx={{ textAlign: 'center', color: theme.palette.text.disabled, py: 4 }}>
                  {searchQuery.trim() ? 'No items match your search.' : 'No shortages reported'}
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={2}>
              {filteredDamaged.filteredItems.length > 0 ? (
                <ItemListComponent
                  items={filteredDamaged.filteredItems}
                  initialExpandedItems={filteredDamaged.itemsToExpand}
                />
              ) : (
                <Typography sx={{ textAlign: 'center', color: theme.palette.text.disabled, py: 4 }}>
                  {searchQuery.trim() ? 'No items match your search.' : 'No damaged items'}
                </Typography>
              )}
            </TabPanel>
          </Box>
        </Container>
      </Box>

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />

      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
