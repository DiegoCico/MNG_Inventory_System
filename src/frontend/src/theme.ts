import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      light: '#98ceff',
      main: '#459cff',
      dark: '#396aca',
      contrastText: '#fff',
    },
    secondary: {
      light: '#f9e9b3',
      main: '#f5db82',
      dark: '#f1ce51',
      contrastText: '#000000',
    },
    text: {
      primary: '#000000',
      secondary: '#3a3a3a',
      disabled: '#9E9E9E',
    },
    background: {
      default: '#d9d9d9',
      paper: '#f2f2f2',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
