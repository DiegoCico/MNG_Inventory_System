import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#243061',       // command navy (for AppBar / links)
      dark: '#1B244A',
      contrastText: '#EDEFF2',
    },
    success: {
      main: '#6A973C',       // olive (tactical)
      dark: '#567C31',
      contrastText: '#0E0F10',
    },
    warning: {
      main: '#D0A139',       // medal gold (sparingly)
      dark: '#B58827',
      contrastText: '#101214',
    },
    background: {
      default: '#0F1114',    // deeper, cleaner base
      paper: '#171A1F',      // card/panel
    },
    text: {
      primary: '#EEF1F3',
      secondary: '#A9B0B6',
      disabled: '#6D747A',
    },
    divider: 'rgba(255,255,255,0.08)',
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
        root: { height: 56, boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: 'lg' },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#171A1F',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
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

export default theme;
