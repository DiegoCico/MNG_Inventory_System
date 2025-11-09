import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  Fade,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function DamageReportsSection({
  damageReports,
  setDamageReports,
  isEditMode,
}: {
  damageReports: string[];
  setDamageReports: (r: string[]) => void;
  isEditMode?: boolean;
}) {
  const [current, setCurrent] = useState("");

  const handleAdd = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    setDamageReports([...damageReports, trimmed]);
    setCurrent("");
  };

  const handleDelete = (index: number) => {
    const updated = damageReports.filter((_, i) => i !== index);
    setDamageReports(updated);
  };

  return (
    <Fade in>
      <Box
        sx={{
          mt: 2,
          p: 2,
          bgcolor: "#fff8e1",
          borderRadius: 2,
          border: "1px solid #ffe082",
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Damage Reports
        </Typography>

        {damageReports.length === 0 ? (
          <Alert
            icon={<InfoOutlinedIcon fontSize="small" />}
            severity="info"
            sx={{
              bgcolor: "#e3f2fd",
              color: "#0d47a1",
              borderRadius: 2,
              mb: 1.5,
            }}
          >
            No damage reports yet.
          </Alert>
        ) : (
          <Stack direction="row" flexWrap="wrap" gap={1} mb={1.5}>
            {damageReports.map((report, i) => (
              <Chip
                key={i}
                label={report}
                onDelete={() => handleDelete(i)}
                deleteIcon={<DeleteIcon />}
                sx={{
                  bgcolor: "#fffde7",
                  border: "1px solid #fbc02d",
                  "& .MuiChip-deleteIcon": { color: "#f57f17" },
                }}
              />
            ))}
          </Stack>
        )}

        {isEditMode && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Describe damage..."
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Tooltip title="Add Report">
              <IconButton
                color="primary"
                onClick={handleAdd}
                sx={{
                  bgcolor: "#1976d2",
                  color: "white",
                  "&:hover": { bgcolor: "#0d47a1" },
                }}
              >
                <AddCircleIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Fade>
  );
}
