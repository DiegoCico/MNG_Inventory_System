import React from "react";
import { Box, Card, Chip, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { StatusChip } from "./Producthelpers";

export default function ChildrenTree({
  editedProduct,
  teamId,
}: {
  editedProduct: any;
  teamId: string;
}) {
  const navigate = useNavigate();

  const renderChildren = (children: any[], level = 0): React.ReactNode => {
    if (!children || children.length === 0) return null;
    return (
      <Stack spacing={1} sx={{ ml: level * 2 }}>
        {children.map((child: any) => (
          <Box key={child.itemId}>
            <Card
              onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
              sx={{
                p: 1,
                cursor: "pointer",
                bgcolor: level === 0 ? "white" : `rgba(25,118,210,${0.05 * (level + 1)})`,
                "&:hover": { bgcolor: "#e3f2fd" },
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {child.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {child.actualName || ""}
              </Typography>
              {child.status && <StatusChip value={child.status} />}
            </Card>
            {child.children?.length > 0 && renderChildren(child.children, level + 1)}
          </Box>
        ))}
      </Stack>
    );
  };

  if (!editedProduct.children || editedProduct.children.length === 0) return null;

  return (
    <Box sx={{ mb: 2, p: 2, bgcolor: "#f0f7ff", borderRadius: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        📦 Kit Contents ({editedProduct.children.length} items)
      </Typography>
      {renderChildren(editedProduct.children, 0)}
    </Box>
  );
}