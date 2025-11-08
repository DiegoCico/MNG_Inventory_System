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
   <Box
    sx={{
        position: "relative",
        bgcolor: "#f8fafc",
        borderRadius: 3,
        border: "1px dashed #cbd5e1",
        overflow: "hidden",
        mb: 3,
        aspectRatio: "1 / 1", 
        width: "100%",
        maxWidth: 500, 
        mx: "auto", 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            <ImageNotSupportedIcon sx={{ fontSize: 72, color: "gray" }} />
            <Typography variant="caption" color="text.secondary">
              No image available
            </Typography>
          </Stack>
        </Box>
      )}

      {isEditMode && (
        <Box sx={{ position: "absolute", bottom: 12, right: 12 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <Stack direction="row" spacing={1}>
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
                <Avatar sx={{ width: 28, height: 28, bgcolor: "warning.main" }}>
                  <WarningAmberIcon fontSize="small" />
                </Avatar>
              </Tooltip>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
