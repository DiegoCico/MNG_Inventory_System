import HeroPage from './pages/HeroPage';
import SignInPage from './pages/SignInPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProductReviewPage from './pages/ProductReviewPage';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamspacePage';
import ToReviewPage from './pages/ToReviewPage';
import ReviewedPage from './pages/ReviewedPage';
import ThemeContextProvider from './ThemeContext';
import { CssBaseline } from '@mui/material';

export default function App() {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/home/:teamId" element={<HomePage />} />
          <Route path="/teams/to-review/:teamId" element={<ToReviewPage />} />
          <Route path="/teams/:teamId/items/:itemId" element={<ProductReviewPage />} />
          <Route path="/teams/reviewed/:teamId" element={<ReviewedPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeContextProvider>
  );
}
