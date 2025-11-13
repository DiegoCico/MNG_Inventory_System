import React, { useState } from 'react';
import { Box, Card, CardMedia, Typography, Stack, IconButton, Collapse, Chip } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTheme, alpha } from '@mui/material/styles';

export interface ItemListItem {
  id: string | number;
  productName: string;
  actualName: string;
  subtitle: string;
  image: string;
  date: string;
  parent?: string | null;
  status?: string;
  children?: ItemListItem[];
}

interface ItemListComponentProps {
  items?: ItemListItem[];
}

export default function ItemListComponent({ items = [] }: ItemListComponentProps) {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<string | number>>(new Set());

  const rootItems = items.filter(item => !item.parent);

  if (rootItems.length === 0) {
    return (
      <Typography sx={{ textAlign: 'center', color: theme.palette.text.disabled, py: 4 }}>
        No items to display
      </Typography>
    );
  }

  const getStatusColor = (status?: string) => {
    const s = (status ?? '').toLowerCase();
    if (s === 'completed') return 'success';
    if (s === 'damaged') return 'error';
    if (s === 'shortages') return 'warning';
    if (s === 'to review') return 'default';
    return 'default';
  };

  const handleItemClick = (itemId: string | number, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.expand-button')) return;
    navigate(`/teams/${teamId}/items/${itemId}`);
  };

  const toggleExpand = (itemId: string | number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const renderItem = (item: ItemListItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    return (
      <Box key={item.id}>
        <Card
          onClick={(e) => handleItemClick(item.id, e)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            padding: { xs: 1.5, sm: 2 },
            backgroundColor: theme.palette.background.paper,
            boxShadow: 'none',
            borderRadius: 2,
            ml: level * 3,
            borderLeft: level > 0 ? `3px solid ${theme.palette.primary.main}` : 'none',
            '&:hover': {
              boxShadow: 2,
              cursor: 'pointer',
            },
          }}
        >
          <Box
            sx={{
              width: { xs: 70, sm: 85, md: 100 },
              height: { xs: 70, sm: 85, md: 100 },
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
              flexShrink: 0,
            }}
          >
            <CardMedia
              component="img"
              image={item.image}
              alt={item.productName}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>

          <Box sx={{ ml: { xs: 1.5, sm: 2 }, flex: 1, display: 'flex', flexDirection: 'column', alignSelf: 'start' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <Typography
                variant="h6"
                component="h2"
                sx={{
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                  fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                }}
              >
                {item.productName}
              </Typography>
              <Typography
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  fontWeight: 400,
                  ml: 2,
                  flexShrink: 0,
                }}
              >
                {item.date}
              </Typography>
            </Box>

            <Typography
              variant="body2"
              component="h2"
              sx={{
                fontWeight: 500,
                color: theme.palette.primary.main,
                fontSize: { xs: '0.75rem', sm: '0.825rem' },
                marginBottom: '0.4rem'
              }}
            >
              {item.actualName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                mb: 0.5
              }}
            >
              {item.subtitle}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {item.status && (
                <Chip
                  label={item.status}
                  size="small"
                  color={getStatusColor(item.status)}
                  sx={{ fontWeight: 600 }}
                />
              )}

              {hasChildren && (
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                  }}
                >
                  📦 {item.children!.length} item{item.children!.length !== 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
          </Box>

          {hasChildren && (
            <IconButton
              className="expand-button"
              onClick={(e) => toggleExpand(item.id, e)}
              sx={{
                ml: 1,
                color: theme.palette.primary.main,
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Card>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto">
            <Box sx={{ mt: 1 }}>
              {item.children!.map(child => renderItem(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Stack spacing={1.5}>
      {rootItems.map((item) => renderItem(item))}
    </Stack>
  );
}
