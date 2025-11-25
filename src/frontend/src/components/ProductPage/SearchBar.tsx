import React from 'react';
import { InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTheme } from '@mui/material/styles';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
                                    value,
                                    onChange,
                                    placeholder = 'Search items...'
                                  }: SearchBarProps) {
  const theme = useTheme();

  return (
    <TextField
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: theme.palette.text.secondary }} />
          </InputAdornment>
        )
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          bgcolor: theme.palette.background.default,
          borderRadius: 3,
          '& fieldset': {
            borderRadius: 3
          }
        },
        '& .MuiInputBase-input': {
          fontSize: '0.9rem'
        }
      }}
    />
  );
}