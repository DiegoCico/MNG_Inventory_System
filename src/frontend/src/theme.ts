import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      lighter: '#C8DFF4',   // Lightest blue
      light: '#9CC4E8',     // Light blue
      main: '#6BA4D8',      // Army National Guard Blue
      dark: '#4A7BA8',      // Dark blue
      darker: '#2B5F8F',    // Darkest blue
      contrastText: '#fff',
    },
    secondary: {
      lighter: '#F0DDA0',   // Lightest gold
      light: '#E5C96B',     // Light gold
      main: '#D4AF37',      // Army National Guard Gold
      dark: '#A88A1F',      // Dark gold
      darker: '#8A6D15',    // Darkest gold
      contrastText: '#000',
    },
    text: {
      primary: '#1B3A5C',
      secondary: '#5A5A5A',
      disabled: '#9E9E9E',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
