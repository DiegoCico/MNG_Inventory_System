// tests/App.test.tsx
import { render, screen } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';
import App from '../src/App';

afterEach(() => {
  vi.restoreAllMocks();
});

test('shows loading then the API message on success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ result: { data: { message: 'Hello from API' } } }),
    } as any)
  );

  render(<App />);

  // initial state
  expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();

  // resolves to the API message
  expect(
    await screen.findByText(/API says: Hello from API/i)
  ).toBeInTheDocument();
});

test('shows fallback message when API fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

  render(<App />);

  expect(
    await screen.findByText(/API says: API not running/i)
  ).toBeInTheDocument();
});
