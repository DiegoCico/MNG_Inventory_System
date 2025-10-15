import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductReviewPage from '../src/pages/ProductReviewPage';

describe('ProductDisplay', () => {
  it('renders product card with key elements', () => {
    render(<ProductReviewPage />);

    // Check that main sections exist
    expect(screen.getByPlaceholderText('Add notes here...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
  });

  it('allows editing notes', () => {
    render(<ProductReviewPage />);

    const notesField = screen.getByPlaceholderText('Add notes here...');
    fireEvent.change(notesField, { target: { value: 'Test notes' } });

    expect(notesField).toHaveValue('Test notes');
  });

  it('allows changing status', () => {
    render(<ProductReviewPage />);

    const statusDropdown = screen.getByRole('combobox');
    fireEvent.mouseDown(statusDropdown);
    fireEvent.click(screen.getByText('Damaged'));

    expect(statusDropdown).toHaveTextContent('Damaged');
  });
});
