import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ThemeContextProvider from "./ThemeContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeContextProvider>
      <App />
    </ThemeContextProvider>
  </React.StrictMode>
);
