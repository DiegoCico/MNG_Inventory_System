/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Box, Card, Chip, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTheme } from '@mui/material/styles';

interface ChildrenTreeProps {
  editedProduct: any;
  teamId: string;
}

export default function ChildrenTree({ editedProduct, teamId }: ChildrenTreeProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Don't show anything if no children
  if (!editedProduct?.children || editedProduct.children.length === 0) {
    return null;
  }

  const toggleExpand = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const renderChild = (child: any, level = 0) => {
    const hasChildren = !!child.children?.length;
    const isExpanded = expandedItems.has(child.itemId);

    return (
      <Box key={child.itemId}>
        <Card
          onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
          sx={{
            p: 1.5,
            cursor: 'pointer',
            bgcolor:
              level === 0
                ? theme.palette.background.paper
                : theme.palette.mode === 'dark'
                  ? `rgba(${theme.palette.primary.main.replace('rgb(', '').replace(')', '')}, ${
                      0.04 * (level + 1)
                    })`
                  : `rgba(25, 118, 210, ${0.05 * (level + 1)})`,
            '&:hover': {
              bgcolor:
                theme.palette.mode === 'dark'
                  ? theme.palette.action.hover
                  : theme.palette.action.hover,
            },
            borderLeft:
              level > 0
                ? `3px solid ${
                    theme.palette.mode === 'dark'
                      ? theme.palette.primary.dark
                      : `rgba(25,118,210,${0.3 + level * 0.2})`
                  }`
                : 'none',
            ml: level * 2,
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {'  '.repeat(level)}├─ {child.name}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                {'  '.repeat(level)} {child.actualName || child.name}
              </Typography>

              {child.status && (
                <Chip
                  label={child.status}
                  size="small"
                  sx={{ ml: 1, mt: 0.5 }}
                  color={
                    child.status === 'Completed'
                      ? 'success'
                      : child.status === 'Damaged'
                        ? 'error'
                        : child.status === 'Shortages'
                          ? 'warning'
                          : child.status === 'To Review'
                            ? 'default'
                            : 'default'
                  }
                />
              )}
            </Box>

            {hasChildren && (
              <IconButton
                onClick={(e) => toggleExpand(child.itemId, e)}
                sx={{ color: theme.palette.primary.main }}
                size="small"
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
        </Card>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto">
            <Box sx={{ mt: 0.5 }}>
              {child.children.map((subChild: any) => renderChild(subChild, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        bgcolor:
          theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.grey[100],
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        📦 Kit Contents ({editedProduct.children.length} item
        {editedProduct.children.length !== 1 ? 's' : ''})
      </Typography>

      <Stack spacing={0.5}>
        {editedProduct.children.map((child: any) => renderChild(child, 0))}
      </Stack>
    </Box>
  );
}
