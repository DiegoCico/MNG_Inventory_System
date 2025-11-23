import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AddInventoryCard from '../../src/components/HomePage/AddInventoryCard';

const theme = createTheme();

const renderWithRouter = (teamId: string) => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AddInventoryCard teamId={teamId} />
      </BrowserRouter>
    </ThemeProvider>,
  );
};

describe('AddInventoryCard', () => {
  describe('Rendering', () => {
    it('renders the card with title', () => {
      renderWithRouter('team-123');

      expect(screen.getByText('Add Inventory')).toBeInTheDocument();
    });

    it('renders the description text', () => {
      renderWithRouter('team-123');

      expect(screen.getByText('Register new inventory items to be reviewed')).toBeInTheDocument();
    });

    it('renders the add inventory button', () => {
      renderWithRouter('team-123');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('links to correct path with teamId', () => {
      renderWithRouter('team-456');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveAttribute('href', '/teams/team-456/items/new');
    });

    it('links to correct path with different teamId', () => {
      renderWithRouter('engineering-team');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveAttribute('href', '/teams/engineering-team/items/new');
    });

    it('button has correct text', () => {
      renderWithRouter('team-123');

      expect(screen.getByText('Add New Inventory Item')).toBeInTheDocument();
    });
  });

  describe('Styling and Structure', () => {
    it('renders as a Paper component', () => {
      const { container } = renderWithRouter('team-123');

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toBeInTheDocument();
    });

    it('button is full width', () => {
      renderWithRouter('team-123');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveClass('MuiButton-fullWidth');
    });

    it('button has primary color', () => {
      renderWithRouter('team-123');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveClass('MuiButton-colorPrimary');
    });

    it('button is contained variant', () => {
      renderWithRouter('team-123');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveClass('MuiButton-contained');
    });
  });

  describe('Props', () => {
    it('handles empty string teamId', () => {
      renderWithRouter('');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      // React Router normalizes paths and removes double slashes
      expect(button).toHaveAttribute('href', '/teams/items/new');
    });

    it('handles teamId with special characters', () => {
      renderWithRouter('team-123-abc_xyz');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveAttribute('href', '/teams/team-123-abc_xyz/items/new');
    });

    it('handles teamId with spaces (URL encoded)', () => {
      renderWithRouter('team 123');

      const button = screen.getByRole('link', { name: /add new inventory item/i });
      expect(button).toHaveAttribute('href', '/teams/team 123/items/new');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithRouter('team-123');

      const heading = screen.getByRole('heading', { name: /add inventory/i });
      expect(heading).toBeInTheDocument();
    });

    it('button is accessible as a link', () => {
      renderWithRouter('team-123');

      const link = screen.getByRole('link', { name: /add new inventory item/i });
      expect(link).toBeInTheDocument();
    });

    it('all text content is visible', () => {
      renderWithRouter('team-123');

      expect(screen.getByText('Add Inventory')).toBeVisible();
      expect(screen.getByText('Register new inventory items to be reviewed')).toBeVisible();
      expect(screen.getByText('Add New Inventory Item')).toBeVisible();
    });
  });

  describe('Theme Integration', () => {
    it('renders without theme errors', () => {
      expect(() => renderWithRouter('team-123')).not.toThrow();
    });

    it('applies theme styling', () => {
      const { container } = renderWithRouter('team-123');

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toHaveClass('MuiPaper-elevation0');
    });
  });
});
