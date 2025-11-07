import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductDisplay from '../src/pages/ProductReviewPage';

const mockProduct = {
  productName: 'Test Laptop',
  actualName: 'Test Brand X1',
  level: 'A',
  description: 'Test description',
  imageLink: 'https://example.com/image.png',
  serialNumber: 'SN123',
  AuthQuantity: 5
};

// Mock fetch globally
global.fetch = vi.fn();

describe('ProductDisplay', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: { data: mockProduct } })
    } as Response);
  });

  it('shows loading state initially', () => {
    render(<ProductDisplay />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders product card after loading', async () => {
    render(<ProductDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Test Laptop')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Add notes here...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
  });

  it('allows editing notes', async () => {
    render(<ProductDisplay />);

    const notesField = await screen.findByPlaceholderText('Add notes here...');
    fireEvent.change(notesField, { target: { value: 'Test notes' } });

    expect(notesField).toHaveValue('Test notes');
  });

  it('allows changing status', async () => {
    render(<ProductDisplay />);

    const statusDropdown = await screen.findByRole('combobox');
    fireEvent.mouseDown(statusDropdown);

    const damagedOption = await screen.findByText('Damaged');
    fireEvent.click(damagedOption);

    expect(statusDropdown).toHaveTextContent('Damaged');
  });
});

