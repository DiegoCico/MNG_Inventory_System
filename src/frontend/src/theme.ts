import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#283996', // command blue (AppBar, buttons)
      dark: '#1D2D77',
      contrastText: '#F7F7F7',
    },
    secondary: {
      main: '#3A3A3A', // neutral text tone
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#D0A139', // medal gold (buttons)
      dark: '#B58827',
      contrastText: '#101214',
    },
    background: {
      default: '#F4F4F1', // hero background
      paper: '#FFFFFF', // cards, dialogs
    },
    text: {
      primary: '#1F1F1F', // main headings
      secondary: '#3A3A3A', // paragraphs
      disabled: '#7A7A7A',
    },
    divider: 'rgba(0,0,0,0.1)',
  },
  typography: {
    fontFamily: '"Roboto Condensed","Inter","Helvetica","Arial",sans-serif',
    h1: { fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.1 },
    h2: { fontWeight: 800, letterSpacing: '0.01em' },
    h6: { fontWeight: 800 },
    button: { fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#283996',
          color: '#F7F7F7',
          height: 56,
          boxShadow: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: 'lg' },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 800 },
        containedPrimary: {
          backgroundColor: '#283996',
          color: '#F7F7F7',
          '&:hover': { backgroundColor: '#1D2D77' },
        },
        containedWarning: {
          backgroundColor: '#D0A139',
          color: '#101214',
          '&:hover': { backgroundColor: '#B58827' },
        },
        outlined: {
          color: '#F7F7F7',
          borderColor: 'rgba(247,247,247,0.6)',
          '&:hover': {
            borderColor: '#FFFFFF',
            backgroundColor: 'rgba(247,247,247,0.1)',
          },
        },
        text: {
          color: '#1F1F1F',
          '&:hover': { backgroundColor: 'rgba(40,57,150,0.08)' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.15)',
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
