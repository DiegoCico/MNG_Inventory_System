import React, { createContext, useMemo, useState, useContext } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createTheme } from "@mui/material/styles";
import lightTheme from "./theme";
import darkThemeOptions from "./themeDark"; 

interface ThemeContextType {
  toggleTheme: () => void;
  mode: "light" | "dark";
}

const ColorModeContext = createContext<ThemeContextType>({
  toggleTheme: () => {},
  mode: "light",
});

export const useColorMode = () => useContext(ColorModeContext);

export default function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  const toggleTheme = () => setMode((prev) => (prev === "light" ? "dark" : "light"));

  const theme = useMemo(
    () => createTheme(mode === "light" ? lightTheme : darkThemeOptions),
    [mode]
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
