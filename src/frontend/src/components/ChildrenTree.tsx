/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Box, Card, Chip, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface ChildrenTreeProps {
  editedProduct: any;
  teamId: string;
}

export default function ChildrenTree({ editedProduct, teamId }: ChildrenTreeProps) {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  console.log('[ChildrenTree] editedProduct:', editedProduct);
  console.log('[ChildrenTree] children:', editedProduct?.children);

  // Don't show anything if no children
  if (!editedProduct?.children || editedProduct.children.length === 0) {
    return null;
  }

  const toggleExpand = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const renderChild = (child: any, level = 0) => {
    const hasChildren = child.children && child.children.length > 0;
    const isExpanded = expandedItems.has(child.itemId);

    return (
      <Box key={child.itemId}>
        <Card
          onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}  // FIXED
          sx={{
            p: 1.5,
            cursor: 'pointer',
            bgcolor: level === 0 ? 'white' : `rgba(25, 118, 210, ${0.05 * (level + 1)})`,
            '&:hover': { bgcolor: '#e3f2fd' },
            borderLeft: level > 0 ? `3px solid rgba(25, 118, 210, ${0.3 + level * 0.2})` : 'none',
            ml: level * 2,
            mb: 1
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
                    child.status === 'Completed' ? 'success' :
                      child.status === 'Damaged' ? 'error' :
                        child.status === 'Shortages' ? 'warning' :
                          child.status === 'To Review' ? 'default' :
                            'default'
                  }
                />
              )}
            </Box>

            {hasChildren && (
              <IconButton
                onClick={(e) => toggleExpand(child.itemId, e)}
                sx={{ color: 'primary.main' }}
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
    <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f7ff', borderRadius: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        📦 Kit Contents ({editedProduct.children.length} item{editedProduct.children.length !== 1 ? 's' : ''})
      </Typography>
      <Stack spacing={0.5}>
        {editedProduct.children.map((child: any) => renderChild(child, 0))}
      </Stack>
    </Box>
  );
}
