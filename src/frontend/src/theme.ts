import { createTheme, ThemeOptions } from '@mui/material/styles';

// Shared color palette for both light and dark modes
const paletteBase = {
  primary: {
    main: '#243061',       // command navy
    dark: '#1B244A',
    contrastText: '#EDEFF2',
  },
  success: {
    main: '#6A973C',       // olive
    dark: '#567C31',
    contrastText: '#0E0F10',
  },
  warning: {
    main: '#D0A139',       // medal gold
    dark: '#B58827',
    contrastText: '#101214',
  },
  divider: 'rgba(255,255,255,0.08)',
};

// Function that generates theme tokens based on mode
const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    ...paletteBase,
    background: {
      default: mode === 'dark' ? '#0F1114' : '#F7F8FA',
      paper: mode === 'dark' ? '#171A1F' : '#FFFFFF',
    },
    text: {
      primary: mode === 'dark' ? '#EEF1F3' : '#0F1114',
      secondary: mode === 'dark' ? '#A9B0B6' : '#4B5563',
      disabled: mode === 'dark' ? '#6D747A' : '#9CA3AF',
    },
  },
  typography: {
    fontFamily: '"Roboto Condensed","Inter","Helvetica","Arial",sans-serif',
    h1: { fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.1 },
    h2: { fontWeight: 700, letterSpacing: '0.01em' },
    h5: { fontWeight: 700 },
    button: { fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          height: 56,
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: 'lg' as 'lg' }, // ✅ Type-safe cast
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#171A1F' : '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
        containedPrimary: {
          backgroundColor: '#243061',
          '&:hover': { backgroundColor: '#1B244A' },
        },
        containedWarning: {
          color: '#101214',
          '&:hover': { backgroundColor: '#B58827' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, letterSpacing: '0.06em' },
      },
    },
  },
});

// Create your default (dark) theme
const theme = createTheme(getDesignTokens('light'));
export default theme;

// Optional: export the function for a light/dark toggle feature
export { getDesignTokens };
