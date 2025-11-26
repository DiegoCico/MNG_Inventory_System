import React, { useState, useEffect } from 'react';
import { Box, Card, CardMedia, Typography, IconButton, Collapse } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
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
  isKit?: boolean;
  children?: ItemListItem[];
}

interface ItemListComponentProps {
  items?: ItemListItem[];
  initialExpandedItems?: Set<string | number>;
}

export default function ItemListComponent({
                                            items = [],
                                            initialExpandedItems
                                          }: ItemListComponentProps) {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<string | number>>(
    initialExpandedItems || new Set()
  );

  // Update expanded items when initialExpandedItems changes
  useEffect(() => {
    if (initialExpandedItems) {
      setExpandedItems(initialExpandedItems);
    }
  }, [initialExpandedItems]);

  const rootItems = items.filter((item) => !item.parent);

  if (rootItems.length === 0) {
    return (
      <Typography sx={{ textAlign: 'center', color: theme.palette.text.disabled, py: 4 }}>
        No items to display
      </Typography>
    );
  }

  // Recursively count all nested children (including all descendants)
  const getTotalChildCount = (item: ItemListItem): number => {
    if (!item.children || item.children.length === 0) {
      return 0;
    }

    let count = 0;
    item.children.forEach((child) => {
      count += 1; // Count the child itself
      count += getTotalChildCount(child); // Count the child's descendants
    });

    return count;
  };

  const getStatusColor = (status?: string) => {
    const s = (status ?? '').toLowerCase();
    if (s === 'completed') return { bg: '#d4edda', text: '#155724' };
    if (s === 'damaged') return { bg: '#f8d7da', text: '#721c24' };
    if (s === 'shortages') return { bg: '#fff3cd', text: '#856404' };
    if (s === 'to review') return { bg: '#e7f3ff', text: '#004085' };
    return { bg: '#e2e3e5', text: '#383d41' };
  };

  const handleItemClick = (itemId: string | number, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.expand-button')) return;
    navigate(`/teams/${teamId}/items/${itemId}`);
  };

  const toggleExpand = (itemId: string | number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleAddItemClick = (parentId: string | number) => {
    navigate(`/teams/${teamId}/items/new`, {
      state: { parentId: parentId },
    });
  };

  const renderAddItemButton = (parentId: string | number, level: number) => {
    return (
      <Box sx={{ mb: 1 }}>
        <Card
          onClick={() => handleAddItemClick(parentId)}
          sx={{
            display: 'grid',
            gridTemplateColumns: '96px 1fr',
            gap: 2,
            alignItems: 'center',
            p: 2,
            ml: level * 3,
            backgroundColor: alpha(theme.palette.primary.main, 0.02),
            border: '2px dashed',
            borderColor: alpha(theme.palette.primary.main, 0.3),
            borderRadius: 2,
            transition: 'all 0.2s ease',
            minHeight: 112,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              borderColor: theme.palette.primary.main,
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
            },
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            <AddIcon
              sx={{
                fontSize: 48,
                color: theme.palette.primary.main,
              }}
            />
          </Box>

          {/* Content */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                color: theme.palette.primary.main,
              }}
            >
              Add New Item
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  };

  const renderItem = (item: ItemListItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const totalChildCount = getTotalChildCount(item);
    const isExpanded = expandedItems.has(item.id);
    const statusColors = getStatusColor(item.status);
    const isKit = item.isKit;

    return (
      <Box key={item.id} sx={{ mb: 1 }}>
        <Card
          onClick={(e) => handleItemClick(item.id, e)}
          sx={{
            display: 'grid',
            gridTemplateColumns: '96px 1fr auto',
            gap: 2,
            alignItems: 'center',
            p: 2,
            ml: level * 3,
            backgroundColor:
              level > 0
                ? alpha(theme.palette.background.paper, 0.6)
                : theme.palette.background.paper,
            border: '1px solid',
            borderColor: 'transparent',
            borderRadius: 2,
            transition: 'all 0.2s ease',
            position: 'relative',
            boxShadow: 'none',
            minHeight: 112,
            ...(level > 0 && {
              borderLeft: `3px solid ${theme.palette.primary.main}`,
            }),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              borderColor: alpha(theme.palette.primary.main, 0.3),
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
              cursor: 'pointer',
              '& .item-image': {
                transform: 'scale(1.05)',
              },
            },
          }}
        >
          {/* Image */}
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 1.5,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: `0 2px 8px ${alpha('#000', 0.1)}`,
            }}
          >
            <CardMedia
              component="img"
              image={item.image}
              alt={item.productName}
              className="item-image"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.2s ease',
              }}
            />
          </Box>

          {/* Content */}
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                color: theme.palette.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.productName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                fontSize: '0.9rem',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.actualName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                fontSize: '0.85rem',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.subtitle}
            </Typography>
          </Box>

          {/* Right side - Date, Children count, Status & Expand button */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 1,
              flexShrink: 0,
              height: '100%',
              minHeight: 96,
            }}
          >
            {/* Top section - Date and Children count */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.date}
              </Typography>

              {isKit && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  📦 {totalChildCount} {totalChildCount === 1 ? 'item' : 'items'}
                </Box>
              )}
            </Box>

            {/* Bottom section - Kit/Item indicator, Status and Expand button */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {/* Kit/Item Indicator */}
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: isKit
                    ? alpha(theme.palette.info.main, 0.1)
                    : alpha(theme.palette.success.main, 0.1),
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: isKit ? theme.palette.info.main : theme.palette.success.main,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  flexShrink: 0,
                }}
              >
                {isKit ? 'Kit' : 'Item'}
              </Box>

              {item.status && (
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: statusColors.bg,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: statusColors.text,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    flexShrink: 0,
                  }}
                >
                  {item.status}
                </Box>
              )}

              {/* Show expand button for all kits, even with 0 children */}
              {isKit && (
                <IconButton
                  className="expand-button"
                  onClick={(e) => toggleExpand(item.id, e)}
                  size="small"
                  sx={{
                    color: theme.palette.text.secondary,
                    flexShrink: 0,
                    '&:hover': {
                      color: theme.palette.primary.main,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  {isExpanded ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              )}
            </Box>
          </Box>
        </Card>

        {/* Show collapse for all kits, even with 0 children */}
        {isKit && (
          <Collapse in={isExpanded} timeout="auto">
            <Box sx={{ mt: 1 }}>
              {hasChildren && item.children!.map((child) => renderItem(child, level + 1))}
              {/* Add button for kits */}
              {renderAddItemButton(item.id, level + 1)}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return <Box>{rootItems.map((item) => renderItem(item))}</Box>;
}
