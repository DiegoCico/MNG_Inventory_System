/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import HomePage from '../../src/pages/HomePage';
import * as itemsAPI from '../../src/api/items';
import * as authAPI from '../../src/api/auth';
import * as homeAPI from '../../src/api/home';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/api/items');
vi.mock('../../src/api/auth');
vi.mock('../../src/api/home');

// Mock child components
vi.mock('../../src/components/TopBar', () => ({
  default: ({ onProfileClick }: any) => (
    <div data-testid="topbar">
      <button onClick={onProfileClick}>Profile</button>
    </div>
  ),
}));

vi.mock('../../src/components/NavBar', () => ({
  default: () => <div data-testid="navbar">NavBar</div>,
}));

vi.mock('../../src/components/Profile', () => ({
  default: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="profile">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../../src/components/HomePage/InventoryStatus', () => ({
  default: ({ teamName, totals }: any) => (
    <div data-testid="inventory-status">
      <span>Team: {teamName}</span>
      <span>ToReview: {totals.toReview}</span>
      <span>Completed: {totals.completed}</span>
      <span>Shortages: {totals.shortages}</span>
      <span>Damaged: {totals.damaged}</span>
    </div>
  ),
}));

vi.mock('../../src/components/HomePage/InventoryReviewed', () => ({
  default: ({ percentReviewed, onChangeTimeMode, onChangeValue }: any) => (
    <div data-testid="inventory-reviewed">
      <span>Percent: {percentReviewed}%</span>
      <button onClick={() => onChangeTimeMode('days')}>Change Mode</button>
      <button onClick={() => onChangeValue(10)}>Change Value</button>
    </div>
  ),
}));

vi.mock('../../src/components/HomePage/FollowUpsTable', () => ({
  default: ({ followUps }: any) => (
    <div data-testid="followups-table">FollowUps: {followUps.length}</div>
  ),
}));

vi.mock('../../src/components/HomePage/AddInventoryCard', () => ({
  default: () => <div data-testid="add-inventory">Add Inventory</div>,
}));

vi.mock('../../src/components/HomePage/RestartInventoryCard', () => ({
  default: () => <div data-testid="restart-inventory">Restart</div>,
}));

vi.mock('../../src/components/HomePage/TeamActivityChart', () => ({
  default: ({ teamStats }: any) => (
    <div data-testid="team-activity">TeamStats: {teamStats.length}</div>
  ),
}));

const theme = createTheme();

const renderWithRouter = (teamId = 'team-123') => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
        <Routes>
          <Route path="/teams/:teamId" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe('HomePage', () => {
  const mockUser = {
    userId: 'user-123',
    name: 'Test User',
    username: 'testuser',
    role: 'member',
    authenticated: true,
  };
  const mockTeam = { success: true, team: { name: 'Test Team' } };

  beforeEach(() => {
    vi.clearAllMocks();
    (authAPI.me as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (homeAPI.getTeam as ReturnType<typeof vi.fn>).mockResolvedValue(mockTeam);
  });

  describe('Initial Render and Loading', () => {
    it('renders loading state initially', () => {
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithRouter();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders all main components after successful data load', async () => {
      const mockItems = {
        success: true,
        items: [{ itemId: '1', name: 'Item 1', status: 'completed', createdBy: 'user-1' }],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('inventory-status')).toBeInTheDocument();
        expect(screen.getByTestId('inventory-reviewed')).toBeInTheDocument();
        expect(screen.getByTestId('followups-table')).toBeInTheDocument();
        expect(screen.getByTestId('add-inventory')).toBeInTheDocument();
        expect(screen.getByTestId('restart-inventory')).toBeInTheDocument();
        expect(screen.getByTestId('team-activity')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('fetches user, team, and items data on mount', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter('team-456');

      await waitFor(() => {
        expect(authAPI.me).toHaveBeenCalledTimes(1);
        expect(homeAPI.getTeam).toHaveBeenCalledWith('team-456', 'user-123');
        expect(itemsAPI.getItems).toHaveBeenCalledWith('team-456');
      });
    });

    it('handles missing team ID', async () => {
      render(
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/teams/']}>
            <Routes>
              <Route path="/teams/" element={<HomePage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('Missing team ID')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles unsuccessful items fetch', async () => {
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Failed to fetch items',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch items')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Data Processing', () => {
    it('correctly calculates totals for different statuses', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'to review', createdBy: 'user-1' },
          { itemId: '2', status: 'completed', createdBy: 'user-1' },
          { itemId: '3', status: 'shortages', createdBy: 'user-2' },
          { itemId: '4', status: 'damaged', createdBy: 'user-2' },
          { itemId: '5', status: 'to review', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('ToReview: 2')).toBeInTheDocument();
        expect(screen.getByText('Completed: 1')).toBeInTheDocument();
        expect(screen.getByText('Shortages: 1')).toBeInTheDocument();
        expect(screen.getByText('Damaged: 1')).toBeInTheDocument();
      });
    });

    it('calculates correct percentage reviewed', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'completed', createdBy: 'user-1' },
          { itemId: '2', status: 'completed', createdBy: 'user-1' },
          { itemId: '3', status: 'to review', createdBy: 'user-1' },
          { itemId: '4', status: 'to review', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        // 2 completed out of 4 total = 50%
        expect(screen.getByText('Percent: 50%')).toBeInTheDocument();
      });
    });

    it('handles items with missing status (default to "to review")', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', createdBy: 'user-1' }, // No status
          { itemId: '2', status: null, createdBy: 'user-1' }, // Null status
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('ToReview: 2')).toBeInTheDocument();
      });
    });

    it('creates follow-ups for damaged and shortages items', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', name: 'Item 1', status: 'damaged', createdBy: 'user-1' },
          { itemId: '2', name: 'Item 2', status: 'shortages', createdBy: 'user-2' },
          { itemId: '3', name: 'Item 3', status: 'completed', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        // Should show 2 follow-ups (damaged + shortages)
        expect(screen.getByText('FollowUps: 2')).toBeInTheDocument();
      });
    });

    it('aggregates team stats by user', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'completed', createdBy: 'user-1' },
          { itemId: '2', status: 'completed', createdBy: 'user-1' },
          { itemId: '3', status: 'shortages', createdBy: 'user-1' },
          { itemId: '4', status: 'completed', createdBy: 'user-2' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        // Should have stats for 2 users
        expect(screen.getByText('TeamStats: 2')).toBeInTheDocument();
      });
    });

    it('handles empty items array', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('ToReview: 0')).toBeInTheDocument();
        expect(screen.getByText('Completed: 0')).toBeInTheDocument();
        expect(screen.getByText('Percent: 0%')).toBeInTheDocument();
      });
    });

    it('handles non-array items response', async () => {
      const mockItems = { success: true, items: null as unknown as string };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      // When items is null, the component treats it as an error
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch items')).toBeInTheDocument();
      });
    });

    it('includes all follow-up fields', async () => {
      const mockItems = {
        success: true,
        items: [
          {
            itemId: 'item-1',
            name: 'Damaged Item',
            status: 'damaged',
            parent: 'parent-1',
            updatedAt: '2024-01-01T00:00:00Z',
            createdBy: 'user-1',
          },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('FollowUps: 1')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('opens and closes profile dialog', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('topbar')).toBeInTheDocument();
      });

      // Profile should not be visible initially
      expect(screen.queryByTestId('profile')).not.toBeInTheDocument();

      // Click profile button
      const profileButton = screen.getByText('Profile');
      fireEvent.click(profileButton);

      // Profile should be visible
      expect(screen.getByTestId('profile')).toBeInTheDocument();

      // Close profile
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      // Profile should be hidden
      expect(screen.queryByTestId('profile')).not.toBeInTheDocument();
    });

    it('navigates back when back button is clicked', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /back/i });
        fireEvent.click(backButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/teams');
    });

    it('updates time mode when changed', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        const changeModeButton = screen.getByText('Change Mode');
        fireEvent.click(changeModeButton);
        expect(screen.getByTestId('inventory-reviewed')).toBeInTheDocument();
      });
    });

    it('updates selected value when changed', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        const changeValueButton = screen.getByText('Change Value');
        fireEvent.click(changeValueButton);
        expect(screen.getByTestId('inventory-reviewed')).toBeInTheDocument();
      });
    });
  });

  describe('Team Name Display', () => {
    it('displays team name from API', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);
      (homeAPI.getTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        team: { name: 'Engineering Team' },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Team: Engineering Team')).toBeInTheDocument();
      });
    });

    it('falls back to teamId if team name is not available', async () => {
      const mockItems = { success: true, items: [] };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);
      (homeAPI.getTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
      });

      renderWithRouter('team-789');

      await waitFor(() => {
        expect(screen.getByText('Team: team-789')).toBeInTheDocument();
      });
    });
  });

  describe('User Stats Aggregation', () => {
    it('tracks completed items per user', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'completed', createdBy: 'user-1' },
          { itemId: '2', status: 'completed', createdBy: 'user-1' },
          { itemId: '3', status: 'completed', createdBy: 'user-2' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('TeamStats: 2')).toBeInTheDocument();
      });
    });

    it('tracks shortages items per user', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'shortages', createdBy: 'user-1' },
          { itemId: '2', status: 'shortages', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('TeamStats: 1')).toBeInTheDocument();
      });
    });

    it('tracks damaged items per user', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'damaged', createdBy: 'user-1' },
          { itemId: '2', status: 'damaged', createdBy: 'user-2' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('TeamStats: 2')).toBeInTheDocument();
      });
    });

    it('handles user with unknown createdBy', async () => {
      const mockItems = {
        success: true,
        items: [{ itemId: '1', status: 'completed' }], // No createdBy
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('TeamStats: 1')).toBeInTheDocument();
      });
    });
  });

  describe('Percentage Calculation Edge Cases', () => {
    it('calculates 100% when all items reviewed', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'completed', createdBy: 'user-1' },
          { itemId: '2', status: 'damaged', createdBy: 'user-1' },
          { itemId: '3', status: 'shortages', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Percent: 100%')).toBeInTheDocument();
      });
    });

    it('rounds percentage to nearest integer', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'completed', createdBy: 'user-1' },
          { itemId: '2', status: 'to review', createdBy: 'user-1' },
          { itemId: '3', status: 'to review', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        // 1/3 = 33.33%, should round to 33%
        expect(screen.getByText('Percent: 33%')).toBeInTheDocument();
      });
    });
  });

  describe('Status Case Insensitivity', () => {
    it('handles mixed case status values', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'To Review', createdBy: 'user-1' },
          { itemId: '2', status: 'COMPLETED', createdBy: 'user-1' },
          { itemId: '3', status: 'Shortages', createdBy: 'user-1' },
          { itemId: '4', status: 'DAMAGED', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('ToReview: 1')).toBeInTheDocument();
        expect(screen.getByText('Completed: 1')).toBeInTheDocument();
        expect(screen.getByText('Shortages: 1')).toBeInTheDocument();
        expect(screen.getByText('Damaged: 1')).toBeInTheDocument();
      });
    });

    it('defaults unknown status to "to review"', async () => {
      const mockItems = {
        success: true,
        items: [
          { itemId: '1', status: 'unknown-status', createdBy: 'user-1' },
          { itemId: '2', status: 'random', createdBy: 'user-1' },
        ],
      };
      (itemsAPI.getItems as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('ToReview: 2')).toBeInTheDocument();
      });
    });
  });
});
