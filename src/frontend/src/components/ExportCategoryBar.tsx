import React from "react";
import { Box, Button, useTheme } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BuildIcon from "@mui/icons-material/Build";

interface ExportCategoryBarProps {
  activeCategory: "completed" | "broken";
  onCategoryChange: (category: "completed" | "broken") => void;
}

export default function ExportCategoryBar({
  activeCategory,
  onCategoryChange,
}: ExportCategoryBarProps) {
  const theme = useTheme();

  const categories = [
    {
      id: "completed" as const,
      label: "Completed Inventory",
      icon: <CheckCircleIcon />,
    },
    {
      id: "broken" as const,
      label: "Broken Items",
      icon: <BuildIcon />,
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        gap: 2,
        mb: 4,
        flexWrap: "wrap",
      }}
    >
      {categories.map((category) => {
        const isActive = activeCategory === category.id;

        return (
          <Button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            startIcon={category.icon}
            variant={isActive ? "contained" : "outlined"}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              fontWeight: 700,
              textTransform: "none",
              fontSize: "1rem",
              minWidth: 200,
              border: isActive
                ? "none"
                : `2px solid ${theme.palette.divider}`,
              bgcolor: isActive ? theme.palette.warning.main : "transparent",
              color: isActive
                ? theme.palette.getContrastText(theme.palette.warning.main)
                : theme.palette.text.primary,
              "&:hover": {
                bgcolor: isActive
                  ? theme.palette.warning.dark
                  : theme.palette.action.hover,
                border: isActive
                  ? "none"
                  : `2px solid ${theme.palette.text.secondary}`,
              },
            }}
          >
            {category.label}
          </Button>
        );
      })}
    </Box>
  );
}