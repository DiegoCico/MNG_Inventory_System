<<<<<<< Updated upstream
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

  const rootItems = items.filter((item) => !item.parent);

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
    setExpandedItems((prev) => {
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

          <Box
            sx={{
              ml: { xs: 1.5, sm: 2 },
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'start',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
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
                marginBottom: '0.4rem',
              }}
            >
              {item.actualName}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                mb: 0.5,
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
            <Box sx={{ mt: 1 }}>{item.children!.map((child) => renderItem(child, level + 1))}</Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return <Stack spacing={1.5}>{rootItems.map((item) => renderItem(item))}</Stack>;
}
=======
import React, { useState } from 'react';
import { Box, Card, CardMedia, Typography, IconButton, Collapse } from '@mui/material';
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
    const statusColors = getStatusColor(item.status);

    return (
      <Box key={item.id} sx={{ mb: 0.75 }}>
        <Card
          onClick={(e) => handleItemClick(item.id, e)}
          sx={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr auto auto',
            gap: 1.5,
            alignItems: 'center',
            p: 1,
            ml: level * 3,
            backgroundColor: level > 0 ? alpha(theme.palette.background.paper, 0.6) : theme.palette.background.paper,
            border: '1px solid',
            borderColor: 'transparent',
            borderRadius: 1.5,
            transition: 'all 0.2s ease',
            position: 'relative',
            boxShadow: 'none',
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
              }
            },
          }}
        >
          {/* Image */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 1,
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
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: theme.palette.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.productName}
              </Typography>
              {item.status && (
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    backgroundColor: statusColors.bg,
                    fontSize: '0.65rem',
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
            </Box>

            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8rem',
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
                fontSize: '0.75rem',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.subtitle}
            </Typography>
          </Box>

          {/* Right side - Children count & Date */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            {hasChildren && (
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
                📦 {item.children!.length}
              </Box>
            )}

            <Typography
              sx={{
                fontSize: '0.75rem',
                color: theme.palette.text.secondary,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {item.date}
            </Typography>
          </Box>

          {/* Expand button */}
          {hasChildren && (
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
              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
        </Card>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto">
            <Box sx={{ mt: 0.75 }}>
              {item.children!.map(child => renderItem(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box>
      {rootItems.map((item) => renderItem(item))}
    </Box>
  );
}
>>>>>>> Stashed changes
