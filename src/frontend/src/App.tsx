import { CssBaseline } from '@mui/material';
import HeroPage from './pages/HeroPage';
import SignInPage from './pages/SignInPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ProductReviewPage from './pages/ProductReviewPage';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamspacePage';
import ThemeContextProvider from './ThemeContext'; // your provider

export default function App() {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/product/item" element={<ProductReviewPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/home/:teamId" element={<HomePage />} /> 
        </Routes>
      </BrowserRouter>
    </ThemeContextProvider>
  );
}
