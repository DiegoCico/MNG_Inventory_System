import React, { createContext, useMemo, useState, useContext } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import lightTheme from './theme';
import darkThemeOptions from './themeDark';

interface ThemeContextType {
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}

const ColorModeContext = createContext<ThemeContextType>({
  toggleTheme: () => {},
  mode: 'light',
});

export const useColorMode = () => useContext(ColorModeContext);

export default function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  // load the mode from localStorage (default to light mode to start)
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('themeMode');
    return stored === 'dark' ? 'dark' : 'light';
  });

  // toggle and save the current mode to localStorage
  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', next);
      return next;
    });
  };
  // const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const theme = useMemo(
    () => createTheme(mode === 'light' ? lightTheme : darkThemeOptions),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={{ toggleTheme, mode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
