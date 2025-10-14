import { render, screen } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';
import HeroPage from '../src/pages/HeroPage';
import { BrowserRouter } from 'react-router-dom';

afterEach(() => {
  vi.restoreAllMocks();
});

// test('shows loading then the API message on success', async () => {
//   vi.stubGlobal(
//     'fetch',
//     vi.fn().mockResolvedValue({
//       json: async () => ({ result: { data: { message: 'Hello world' } } }),
//     } as string | Response)
//   );

//   render(
//     <BrowserRouter>
//       <HeroPage />
//     </BrowserRouter>
//   );

//   // initial state
//   expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();

//   // resolves to the API message
//   expect(
//     await screen.findByText(/Hello world/i)
//   ).toBeInTheDocument();
// });

test('shows fallback message when API fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

  render(
    <BrowserRouter>
      <HeroPage />
    </BrowserRouter>,
  );

  expect(await screen.findByText(/API not running/i)).toBeInTheDocument();
});

test('Sign In button has correct link', () => {
  render(
    <BrowserRouter>
      <HeroPage />
    </BrowserRouter>,
  );

  const signInButton = screen.getByText(/sign in/i);
  expect(signInButton).toHaveAttribute('href', '/signin');
});

test('Sign Up button has correct link', () => {
  render(
    <BrowserRouter>
      <HeroPage />
    </BrowserRouter>,
  );

  const signUpButton = screen.getByText(/sign up/i);
  expect(signUpButton).toHaveAttribute('href', '/signup');
});
