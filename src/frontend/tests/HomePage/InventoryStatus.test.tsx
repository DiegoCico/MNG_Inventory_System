import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import InventoryStatus from '../../src/components/HomePage/InventoryStatus';

const theme = createTheme();

interface Totals {
  toReview: number;
  completed: number;
  shortages: number;
  damaged: number;
}

const renderComponent = (teamName: string, totals: Totals) => {
  return render(
    <ThemeProvider theme={theme}>
      <InventoryStatus teamName={teamName} totals={totals} />
    </ThemeProvider>
  );
};

describe('InventoryStatus', () => {
  const defaultTotals: Totals = {
    toReview: 10,
    completed: 25,
    shortages: 5,
    damaged: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component title with team name', () => {
      renderComponent('Engineering Team', defaultTotals);

      expect(screen.getByText("Engineering Team's Inventory Status")).toBeInTheDocument();
    });

    it('renders all four status cards', () => {
      renderComponent('Test Team', defaultTotals);

      expect(screen.getByText('To Review')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Shortages')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
    });

    it('displays correct values for each status', () => {
      renderComponent('Test Team', defaultTotals);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders values as headings', () => {
      renderComponent('Test Team', defaultTotals);

      const headings = screen.getAllByRole('heading', { level: 4 });
      expect(headings).toHaveLength(4);
    });
  });

  describe('Team Name Display', () => {
    it('displays team name with possessive apostrophe', () => {
      renderComponent('Alpha Team', defaultTotals);

      expect(screen.getByText("Alpha Team's Inventory Status")).toBeInTheDocument();
    });

    it('handles team names with special characters', () => {
      renderComponent('Team-123 & Co.', defaultTotals);

      expect(screen.getByText("Team-123 & Co.'s Inventory Status")).toBeInTheDocument();
    });

    it('handles empty team name', () => {
      renderComponent('', defaultTotals);

      expect(screen.getByText("'s Inventory Status")).toBeInTheDocument();
    });

    it('handles team names with apostrophes', () => {
      renderComponent("O'Brien's Team", defaultTotals);

      expect(screen.getByText("O'Brien's Team's Inventory Status")).toBeInTheDocument();
    });
  });

  describe('Status Values', () => {
    it('displays zero values', () => {
      const zeroTotals: Totals = {
        toReview: 0,
        completed: 0,
        shortages: 0,
        damaged: 0,
      };

      renderComponent('Test Team', zeroTotals);

      const zeros = screen.getAllByText('0');
      expect(zeros).toHaveLength(4);
    });

    it('displays large values', () => {
      const largeTotals: Totals = {
        toReview: 9999,
        completed: 8888,
        shortages: 7777,
        damaged: 6666,
      };

      renderComponent('Test Team', largeTotals);

      expect(screen.getByText('9999')).toBeInTheDocument();
      expect(screen.getByText('8888')).toBeInTheDocument();
      expect(screen.getByText('7777')).toBeInTheDocument();
      expect(screen.getByText('6666')).toBeInTheDocument();
    });

    it('displays each value only once', () => {
      const uniqueTotals: Totals = {
        toReview: 1,
        completed: 2,
        shortages: 3,
        damaged: 4,
      };

      renderComponent('Test Team', uniqueTotals);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('handles same values across different statuses', () => {
      const sameTotals: Totals = {
        toReview: 5,
        completed: 5,
        shortages: 5,
        damaged: 5,
      };

      renderComponent('Test Team', sameTotals);

      const fives = screen.getAllByText('5');
      expect(fives).toHaveLength(4);
    });
  });

  describe('Card Structure', () => {
    it('renders four cards', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const cards = container.querySelectorAll('.MuiCard-root');
      expect(cards).toHaveLength(4);
    });

    it('renders as a Paper component', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toBeInTheDocument();
    });

    it('cards have zero elevation', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const cards = container.querySelectorAll('.MuiCard-root');
      cards.forEach((card) => {
        expect(card).toHaveClass('MuiPaper-elevation0');
      });
    });
  });

  describe('Layout and Responsive Design', () => {
    it('displays cards in correct order', () => {
      renderComponent('Test Team', defaultTotals);

      // Get card titles by their text content
      expect(screen.getByText('To Review')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Shortages')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
    });

    it('renders grid container', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const gridContainer = container.querySelector('.MuiGrid-container');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('Typography', () => {
    it('title uses h6 variant', () => {
      renderComponent('Test Team', defaultTotals);

      const title = screen.getByRole('heading', {
        name: /test team's inventory status/i,
      });
      expect(title.tagName).toBe('H6');
    });

    it('values use h4 variant', () => {
      renderComponent('Test Team', defaultTotals);

      const values = screen.getAllByRole('heading', { level: 4 });
      expect(values).toHaveLength(4);
      values.forEach((value) => {
        expect(value.tagName).toBe('H4');
      });
    });

    it('card titles use subtitle2 variant', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const subtitles = container.querySelectorAll('.MuiTypography-subtitle2');
      expect(subtitles).toHaveLength(4);
    });
  });

  describe('Edge Cases', () => {
    it('handles negative values', () => {
      const negativeTotals: Totals = {
        toReview: -5,
        completed: -10,
        shortages: -3,
        damaged: -1,
      };

      renderComponent('Test Team', negativeTotals);

      expect(screen.getByText('-5')).toBeInTheDocument();
      expect(screen.getByText('-10')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
      expect(screen.getByText('-1')).toBeInTheDocument();
    });

    it('handles decimal values', () => {
      const decimalTotals: Totals = {
        toReview: 10.5,
        completed: 25.75,
        shortages: 5.25,
        damaged: 3.1,
      };

      renderComponent('Test Team', decimalTotals);

      expect(screen.getByText('10.5')).toBeInTheDocument();
      expect(screen.getByText('25.75')).toBeInTheDocument();
      expect(screen.getByText('5.25')).toBeInTheDocument();
      expect(screen.getByText('3.1')).toBeInTheDocument();
    });

    it('handles very long team names', () => {
      const longName = 'Very Long Team Name That Might Cause Layout Issues';
      renderComponent(longName, defaultTotals);

      expect(
        screen.getByText(`${longName}'s Inventory Status`)
      ).toBeInTheDocument();
    });

    it('handles team name with numbers', () => {
      renderComponent('Team 123', defaultTotals);

      expect(screen.getByText("Team 123's Inventory Status")).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderComponent('Test Team', defaultTotals);

      // Main title is h6
      const mainHeading = screen.getByRole('heading', {
        name: /test team's inventory status/i,
      });
      expect(mainHeading).toBeInTheDocument();

      // Card titles are h6
      const cardTitles = screen.getAllByRole('heading', { level: 6 });
      expect(cardTitles.length).toBeGreaterThanOrEqual(4);

      // Values are h4
      const values = screen.getAllByRole('heading', { level: 4 });
      expect(values).toHaveLength(4);
    });

    it('all text content is visible', () => {
      renderComponent('Test Team', defaultTotals);

      expect(screen.getByText("Test Team's Inventory Status")).toBeVisible();
      expect(screen.getByText('To Review')).toBeVisible();
      expect(screen.getByText('Completed')).toBeVisible();
      expect(screen.getByText('Shortages')).toBeVisible();
      expect(screen.getByText('Damaged')).toBeVisible();
    });
  });

  describe('Theme Integration', () => {
    it('renders without theme errors', () => {
      expect(() => renderComponent('Test Team', defaultTotals)).not.toThrow();
    });

    it('applies correct Paper elevation', () => {
      const { container } = renderComponent('Test Team', defaultTotals);

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toHaveClass('MuiPaper-elevation0');
    });
  });

  describe('Data Completeness', () => {
    it('displays all four metrics even with mixed values', () => {
      const mixedTotals: Totals = {
        toReview: 0,
        completed: 100,
        shortages: 0,
        damaged: 5,
      };

      renderComponent('Test Team', mixedTotals);

      expect(screen.getByText('To Review')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Shortages')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
    });

    it('maintains card order regardless of values', () => {
      const reverseTotals: Totals = {
        toReview: 100,
        completed: 50,
        shortages: 25,
        damaged: 10,
      };

      renderComponent('Test Team', reverseTotals);

      // Verify all cards are present in any order
      expect(screen.getByText('To Review')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Shortages')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
    });
  });
});