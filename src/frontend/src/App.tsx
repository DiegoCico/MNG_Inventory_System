import HeroPage from './pages/HeroPage';
import SignInPage from './pages/SignInPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProductReviewPage from './pages/ProductReviewPage';
import theme from './theme';
import { ThemeProvider } from '@emotion/react';
import { CssBaseline } from '@mui/material';
import TeamsPage from './pages/WorkspacePage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/product/item" element={<ProductReviewPage />} />
          <Route path="/workspace" element={<TeamsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
