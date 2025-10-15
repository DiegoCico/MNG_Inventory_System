import HeroPage from './pages/HeroPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProductReviewPage from './pages/ProductReviewPage';
import theme from './theme';
import { ThemeProvider } from '@emotion/react';
import { CssBaseline } from '@mui/material';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/product/item" element={<ProductReviewPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
