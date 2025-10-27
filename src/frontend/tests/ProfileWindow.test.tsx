import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from '../src/components/Profile';

const mockOnClose = vi.fn();
const mockOnProfileImageChange = vi.fn();

describe('Profile Component', () => {
  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnProfileImageChange.mockClear();
  });

  it('displays static profile info correctly', () => {
    render(
      <Profile
        open={true}
        onClose={mockOnClose}
        profileImage={null}
        onProfileImageChange={mockOnProfileImageChange}
        team="Alpha Company"
        permissions="Admin / Reviewer"
      />
    );

    expect(screen.getByText('Your name will go here')).toBeInTheDocument();
    expect(screen.getByText('your.email@example.com')).toBeInTheDocument();
    expect(screen.getByText(/student\s*\/\s*faculty/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha Company')).toBeInTheDocument();
    expect(screen.getByText('Admin / Reviewer')).toBeInTheDocument();
  });

  it('allows uploading a new profile picture', () => {
    render(
      <Profile
        open={true}
        onClose={mockOnClose}
        profileImage={null}
        onProfileImageChange={mockOnProfileImageChange}
        team="Alpha Company"
        permissions="Admin / Reviewer"
      />
    );

    const file = new File(['dummy'], 'avatar.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockOnProfileImageChange).toHaveBeenCalledWith(file);
  });

  it('calls onClose when clicking the close button', () => {
    render(
      <Profile
        open={true}
        onClose={mockOnClose}
        profileImage={null}
        onProfileImageChange={mockOnProfileImageChange}
        team="Alpha Company"
        permissions="Admin / Reviewer"
      />
    );

    const closeButton = screen.getByLabelText('close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
