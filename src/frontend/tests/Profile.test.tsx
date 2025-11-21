import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// 🧩 Mock API modules *before* importing the component
vi.mock('../src/api/auth', () => ({
  me: vi.fn().mockResolvedValue({
    userId: 'u123',
    email: 'tran.b@northeastern.edu',
    name: 'Ben Tran',
    authenticated: true,
    role: 'Admin',
  }),
  logout: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/api/profile', () => ({
  getProfileImage: vi.fn().mockResolvedValue({ url: 'https://example.com/img.png' }),
  uploadProfileImage: vi.fn().mockResolvedValue({ url: 'https://example.com/img2.png' }),
  updateProfile: vi.fn().mockResolvedValue({ success: true }),
}));

import Profile from '../src/components/Profile';

const mockOnClose = vi.fn();

describe('Profile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Profile dialog when open', async () => {
    render(<Profile open={true} onClose={mockOnClose} />);
    await waitFor(() => expect(screen.getByText('Profile')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Ben Tran')).toBeInTheDocument();
  });
});
