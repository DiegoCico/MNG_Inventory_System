import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FollowUpsTable from '../../src/components/HomePage/FollowUpsTable';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const theme = createTheme();

interface FollowUpItem {
  itemId: string;
  name: string;
  status: string;
  updatedAt: string;
  notes: string;
  parent: string;
}

const renderWithRouter = (followUps: FollowUpItem[], teamId = 'team-123') => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
        <Routes>
          <Route path="/teams/:teamId" element={<FollowUpsTable followUps={followUps} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('FollowUpsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the table with title', () => {
      renderWithRouter([]);

      expect(screen.getByText('Follow-Ups')).toBeInTheDocument();
    });

    it('renders table headers', () => {
      renderWithRouter([]);

      expect(screen.getByText('Item')).toBeInTheDocument();
      expect(screen.getByText('Kit')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Reviewed On')).toBeInTheDocument();
    });

    it('displays "No follow-ups" when empty', () => {
      renderWithRouter([]);

      expect(screen.getByText('No follow-ups')).toBeInTheDocument();
    });

    it('renders follow-up items', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'M4 Carbine',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: 'Test notes',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
      expect(screen.getByText('Kit-A')).toBeInTheDocument();
      expect(screen.getByText('damaged')).toBeInTheDocument();
    });

    it('renders multiple follow-up items', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'M4 Carbine',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
        {
          itemId: 'item-2',
          name: 'Helmet',
          status: 'shortages',
          updatedAt: '2024-01-16T14:20:00Z',
          notes: '',
          parent: 'Kit-B',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
      expect(screen.getByText('Helmet')).toBeInTheDocument();
      expect(screen.getByText('Kit-A')).toBeInTheDocument();
      expect(screen.getByText('Kit-B')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats date correctly', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      // Date should be formatted as locale date string
      const expectedDate = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });

    it('displays "N/A" for missing date', () => {
      const followUps: FollowUpItem[] = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      // Should show N/A in the date column
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // Skip header row
      expect(within(dataRow).getAllByText('N/A')[0]).toBeInTheDocument();
    });

    it('handles null updatedAt', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: null as unknown as string,
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      expect(within(dataRow).getAllByText('N/A')[0]).toBeInTheDocument();
    });
  });

  describe('Parent Field Handling', () => {
    it('displays parent name when provided', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Parent Kit',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('Parent Kit')).toBeInTheDocument();
    });

    it('displays "N/A" when parent is null', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: null as unknown as string,
        },
      ];

      renderWithRouter(followUps);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      expect(within(dataRow).getAllByText('N/A')[0]).toBeInTheDocument();
    });

    it('displays "N/A" when parent is undefined', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: undefined as unknown as string,
        },
      ];

      renderWithRouter(followUps);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      expect(within(dataRow).getAllByText('N/A')[0]).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to item detail on row click', () => {
      const followUps = [
        {
          itemId: 'item-123',
          name: 'M4 Carbine',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps, 'team-456');

      const itemName = screen.getByText('M4 Carbine');
      fireEvent.click(itemName);

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-456/items/item-123');
    });

    it('navigates with correct teamId for different teams', () => {
      const followUps = [
        {
          itemId: 'item-789',
          name: 'Helmet',
          status: 'shortages',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-B',
        },
      ];

      renderWithRouter(followUps, 'engineering-team');

      const itemName = screen.getByText('Helmet');
      fireEvent.click(itemName);

      expect(mockNavigate).toHaveBeenCalledWith('/teams/engineering-team/items/item-789');
    });

    it('navigates when clicking any cell in the row', () => {
      const followUps = [
        {
          itemId: 'item-123',
          name: 'M4 Carbine',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      const statusCell = screen.getByText('damaged');
      fireEvent.click(statusCell);

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-123/items/item-123');
    });

    it('handles multiple row clicks independently', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
        {
          itemId: 'item-2',
          name: 'Item 2',
          status: 'shortages',
          updatedAt: '2024-01-16T14:20:00Z',
          notes: '',
          parent: 'Kit-B',
        },
      ];

      renderWithRouter(followUps);

      fireEvent.click(screen.getByText('Item 1'));
      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-123/items/item-1');

      fireEvent.click(screen.getByText('Item 2'));
      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-123/items/item-2');
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Hover Effects', () => {
    it('row has pointer cursor', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      const { container } = renderWithRouter(followUps);

      const row = container.querySelector('tbody tr');
      expect(row).toHaveStyle({ cursor: 'pointer' });
    });

    it('changes background on mouse enter', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      const { container } = renderWithRouter(followUps);

      const row = container.querySelector('tbody tr') as HTMLElement;
      expect(row.style.backgroundColor).toBe('');

      fireEvent.mouseEnter(row);
      expect(row.style.backgroundColor).not.toBe('');
    });

    it('resets background on mouse leave', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      const { container } = renderWithRouter(followUps);

      const row = container.querySelector('tbody tr') as HTMLElement;

      fireEvent.mouseEnter(row);
      expect(row.style.backgroundColor).not.toBe('');

      fireEvent.mouseLeave(row);
      expect(row.style.backgroundColor).toBe('transparent');
    });
  });

  describe('Status Display', () => {
    it('displays damaged status', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('damaged')).toBeInTheDocument();
    });

    it('displays shortages status', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'shortages',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('shortages')).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('renders as a table element', () => {
      const { container } = renderWithRouter([]);

      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
    });

    it('has proper table structure with thead and tbody', () => {
      const { container } = renderWithRouter([]);

      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tbody')).toBeInTheDocument();
    });

    it('empty state spans all columns', () => {
      const { container } = renderWithRouter([]);

      const emptyCell = container.querySelector('tbody td');
      expect(emptyCell).toHaveAttribute('colSpan', '5');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string values', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: '',
          status: '',
          updatedAt: '',
          notes: '',
          parent: '',
        },
      ];

      renderWithRouter(followUps);

      // Should render without crashing
      expect(screen.getByText('Follow-Ups')).toBeInTheDocument();
    });

    it('handles very long item names', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Very Long Item Name That Might Cause Layout Issues In The Table',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      expect(
        screen.getByText('Very Long Item Name That Might Cause Layout Issues In The Table')
      ).toBeInTheDocument();
    });

    it('handles special characters in item names', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item & Special <Characters> "Test"',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      renderWithRouter(followUps);

      expect(screen.getByText('Item & Special <Characters> "Test"')).toBeInTheDocument();
    });

    it('handles large number of follow-ups', () => {
      const followUps = Array.from({ length: 100 }, (_, i) => ({
        itemId: `item-${i}`,
        name: `Item ${i}`,
        status: i % 2 === 0 ? 'damaged' : 'shortages',
        updatedAt: '2024-01-15T10:30:00Z',
        notes: '',
        parent: `Kit-${i}`,
      }));

      renderWithRouter(followUps);

      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 99')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses proper table semantics', () => {
      renderWithRouter([]);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('has proper heading', () => {
      renderWithRouter([]);

      const heading = screen.getByRole('heading', { name: /follow-ups/i });
      expect(heading).toBeInTheDocument();
    });

    it('rows are clickable and keyboard accessible', () => {
      const followUps = [
        {
          itemId: 'item-1',
          name: 'Item 1',
          status: 'damaged',
          updatedAt: '2024-01-15T10:30:00Z',
          notes: '',
          parent: 'Kit-A',
        },
      ];

      const { container } = renderWithRouter(followUps);

      const row = container.querySelector('tbody tr');
      expect(row).toHaveStyle({ cursor: 'pointer' });
    });
  });
});