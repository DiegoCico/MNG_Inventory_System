import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../src/App';

test('shows loading then the API message on success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Hello from API' })
    } as any)
  );

  render(<App />);

  expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();

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
