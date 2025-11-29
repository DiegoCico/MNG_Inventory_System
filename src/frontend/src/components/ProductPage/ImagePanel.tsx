import React, { useRef, useState } from 'react';
import { Box, Button, CardMedia, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import ErrorDialog from '../ErrorDialog';

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
  const [errorMessage, setErrorMessage] = useState('');

  const handlePick = () => fileRef.current?.click();
  
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Check file type (accept images and HEIC/HEIF)
    const isImage = f.type.startsWith('image/');
    const isHEIC = f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
    
    if (!isImage && !isHEIC) {
      setErrorMessage('Please select a valid image file');
      return;
    }

    // Check file size (3MB = 3 * 1024 * 1024 bytes)
    const maxSize = 3 * 1024 * 1024;
    if (f.size > maxSize) {
      setErrorMessage('Image is too large. Please select an image smaller than 3MB.');
      return;
    }

    try {
      let fileToProcess = f;

      // Convert HEIC to JPG if needed
      if (isHEIC) {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: f,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        
        // heic2any might return an array of blobs, get the first one
        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        fileToProcess = new File([blob], f.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
      }

      // Process the file
      const r = new FileReader();
      r.onloadend = () => setImagePreview(r.result as string);
      r.readAsDataURL(fileToProcess);
      setSelectedImageFile(fileToProcess);
    } catch (error) {
      console.error('Error processing image:', error);
      setErrorMessage('Failed to process image. Please try a different file.');
    }
  };

  return (
    <Stack spacing={1} alignItems="center">
      <Box
        sx={{
          position: 'relative',
          bgcolor:
            theme.palette.mode === 'light'
              ? alpha(theme.palette.background.paper, 0.6)
              : alpha(theme.palette.background.default, 0.6),
          borderRadius: 3,
          border: `2px dashed ${alpha(theme.palette.text.primary, isCreateMode && !imagePreview ? 0.3 : 0.2)}`,
          overflow: 'hidden',
          mb: 1,
          aspectRatio: '1 / 1',
          width: '100%',
          maxWidth: { xs: 280, sm: 400, md: 500 },
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 200, sm: 250, md: 300 },
        }}
      >
        {imagePreview ? (
          <CardMedia
            component="img"
            image={imagePreview}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: '0.2s',
            }}
          />
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%" width="100%" p={3}>
            <Stack alignItems="center" spacing={2}>
              <ImageNotSupportedIcon
                sx={{
                  fontSize: { xs: 64, sm: 80, md: 96 },
                  color: theme.palette.text.disabled,
                }}
              />
              <Typography 
                variant="h6" 
                color="text.secondary" 
                sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem' }, fontWeight: 600 }}
              >
                No image available
              </Typography>
              {isEditMode && (
                <>
                  <Button
                    onClick={handlePick}
                    variant="contained"
                    size="medium"
                    startIcon={<AddPhotoAlternateIcon />}
                    sx={{
                      mt: 1,
                      px: 3,
                      py: 1.5,
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      fontWeight: 600,
                    }}
                  >
                    ADD IMAGE
                  </Button>
                  {isCreateMode && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <WarningAmberIcon 
                        sx={{ 
                          fontSize: 20, 
                          color: theme.palette.error.main 
                        }} 
                      />
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: theme.palette.error.main,
                          fontWeight: 600,
                          fontSize: { xs: '0.75rem', sm: '0.875rem' }
                        }}
                      >
                        Image required
                      </Typography>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Box>
        )}
      </Box>

      {isEditMode && imagePreview && (
        <Stack direction="row" spacing={1}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <Button
            onClick={handlePick}
            variant="contained"
            size="small"
            startIcon={<AddPhotoAlternateIcon />}
          >
            Change Image
          </Button>
        </Stack>
      )}
      
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <ErrorDialog
        open={!!errorMessage}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
      />
    </Stack>
  );
}