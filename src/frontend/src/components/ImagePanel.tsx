import React, { useRef } from "react";
import {
  Box,
  Button,
  CardMedia,
  Stack,
  Avatar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";

export default function ImagePanel({
  imagePreview,
  setImagePreview,
  setSelectedImageFile,
  isEditMode,
  isCreateMode,
}: {
  imagePreview: string;
  setImagePreview: (v: string) => void;
  setSelectedImageFile: (f: File | null) => void;
  isEditMode: boolean;
  isCreateMode: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();

  const handlePick = () => fileRef.current?.click();
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onloadend = () => setImagePreview(r.result as string);
      r.readAsDataURL(f);
      setSelectedImageFile(f);
    }
  };

  return (
    <Stack spacing={1} alignItems="center">
      <Box
        sx={{
          position: "relative",
          bgcolor: theme.palette.mode === "light"
            ? alpha(theme.palette.background.paper, 0.6)
            : alpha(theme.palette.background.default, 0.6),
          borderRadius: 3,
          border: `1px dashed ${alpha(theme.palette.text.primary, 0.2)}`,
          overflow: "hidden",
          mb: 1,
          aspectRatio: "1 / 1",
          width: "100%",
          maxWidth: 500,
          mx: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300, // make the box taller for placeholder
        }}
      >
        {imagePreview ? (
          <CardMedia
            component="img"
            image={imagePreview}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "0.2s",
            }}
          />
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
          >
            <Stack alignItems="center" spacing={1}>
              <ImageNotSupportedIcon
                sx={{
                  fontSize: 96, // bigger placeholder
                  color: theme.palette.text.disabled,
                }}
              />
              <Typography variant="h6" color="text.secondary">
                No image available
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {isEditMode && (
        <Stack direction="row" spacing={1}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <Button
            onClick={handlePick}
            variant="contained"
            size="small"
            startIcon={<AddPhotoAlternateIcon />}
          >
            {imagePreview ? "Change Image" : "Add Image"}
          </Button>
          {isCreateMode && !imagePreview && (
            <Tooltip title="Image required for new items">
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: theme.palette.warning.main,
                }}
              >
                <WarningAmberIcon fontSize="small" />
              </Avatar>
            </Tooltip>
          )}
        </Stack>
      )}
    </Stack>
  );
}
