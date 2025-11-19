import { createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8C9EFF',
      dark: '#536DFE',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#B0B0B0',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#EFBF4D',
      dark: '#D19E2C',
      contrastText: '#1A1A1A',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
      disabled: '#888888',
    },
    divider: 'rgba(255,255,255,0.1)',
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
          backgroundColor: '#1E1E1E',
          color: '#FFFFFF',
          height: 56,
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1E1E',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
          },
        },
      },
    },
  },
});

export default darkTheme;
