import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// 🧩 Mock API modules *before* importing the component
// Use vi.hoisted to create the mock function that can be used in vi.mock
const { mockGetItems } = vi.hoisted(() => ({
  mockGetItems: vi.fn(),
}));

vi.mock('../src/api/items', () => ({
  getItems: mockGetItems,
}));

// Mock child components to isolate ExportPage testing
vi.mock('../src/components/TopBar', () => ({
  default: ({ isLoggedIn }: { isLoggedIn: boolean }) => (
    <div data-testid="top-bar">TopBar - {isLoggedIn ? 'Logged In' : 'Logged Out'}</div>
  ),
}));

vi.mock('../src/components/NavBar', () => ({
  default: () => <div data-testid="nav-bar">NavBar</div>,
}));

vi.mock('../src/components/ExportPageContent', () => ({
  default: ({
    items,
    percentReviewed,
    activeCategory,
    csvData,
  }: {
    items: unknown[];
    percentReviewed: number;
    activeCategory: string;
    csvData: unknown[];
  }) => (
    <div data-testid="export-page-content">
      <div>Items Count: {items.length}</div>
      <div>Percent Reviewed: {percentReviewed}%</div>
      <div>Active Category: {activeCategory}</div>
      <div>CSV Data Count: {csvData.length}</div>
    </div>
  ),
}));

// Import after mocks are defined
import ExportPage from '../src/pages/ExportPage';

// Test theme
const theme = createTheme();

// Helper to render component with theme and router
const renderWithProviders = (ui: React.ReactElement, { route = '/export/team123' } = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/export/:teamId" element={ui} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
};

// Mock data
const mockItems = [
  {
    itemId: 'item1',
    name: 'Rifle M4',
    status: 'completed',
    description: 'Standard issue rifle',
    createdAt: 1700000000000,
  },
  {
    itemId: 'item2',
    name: 'Body Armor',
    status: 'damaged',
    description: 'Vest with tear',
    createdAt: 1700000001000,
  },
  {
    itemId: 'item3',
    name: 'Radio',
    status: 'shortages',
    description: 'Missing antenna',
    createdAt: 1700000002000,
  },
  {
    itemId: 'item4',
    name: 'Helmet',
    status: 'to review',
    description: 'Needs inspection',
    createdAt: 1700000003000,
  },
  {
    itemId: 'item5',
    name: 'Backpack',
    status: 'completed',
    description: 'In good condition',
    createdAt: 1700000004000,
  },
  {
    itemId: 'item6',
    name: 'Night Vision',
    status: 'in repair',
    description: 'Battery compartment broken',
    createdAt: 1700000005000,
  },
];

describe('ExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Loading', () => {
    it('renders loading spinner while fetching items', () => {
      mockGetItems.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithProviders(<ExportPage />);

      // Look for the circular progress spinner during loading
      const spinners = screen.getAllByRole('progressbar');
      const loadingSpinner = spinners.find((el) =>
        el.classList.contains('MuiCircularProgress-root'),
      );
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('calls getItems with correct teamId', async () => {
      mockGetItems.mockResolvedValue({ items: mockItems });

      renderWithProviders(<ExportPage />, { route: '/export/team456' });

      await waitFor(() => {
        expect(mockGetItems).toHaveBeenCalledWith('team456');
      });
    });
  });

  describe('Category Bar', () => {
    beforeEach(async () => {
      mockGetItems.mockResolvedValue({ items: mockItems });
    });

    it('renders both category buttons after loading', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Completed Inventory')).toBeInTheDocument();
        expect(screen.getByText('Broken Items')).toBeInTheDocument();
      });
    });

    it('starts with completed category active', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        const completedBtn = screen.getByText('Completed Inventory').closest('button');
        expect(completedBtn).toHaveClass('MuiButton-contained');
      });
    });

    it('switches category when clicking broken items button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Broken Items')).toBeInTheDocument();
      });

      const brokenBtn = screen.getByText('Broken Items');
      await user.click(brokenBtn);

      expect(brokenBtn.closest('button')).toHaveClass('MuiButton-contained');
    });
  });

  describe('Document Generation Flow', () => {
    beforeEach(() => {
      mockGetItems.mockResolvedValue({ items: mockItems });
    });

    it('shows create documents button initially', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });
    });

    it('shows generating state when create button clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });

      const createBtn = screen.getByText('Create Documents');
      await user.click(createBtn);

      expect(screen.getByText('Generating your documents...')).toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    it('renders TopBar with logged in state', async () => {
      mockGetItems.mockResolvedValue({ items: [] });

      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByTestId('top-bar')).toHaveTextContent('Logged In');
      });
    });

    it('renders NavBar at bottom', async () => {
      mockGetItems.mockResolvedValue({ items: [] });

      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles items with missing status field', async () => {
      const itemsWithMissingStatus = [
        { itemId: '1', name: 'Item 1', createdAt: Date.now() },
        { itemId: '2', name: 'Item 2', status: 'completed', createdAt: Date.now() },
      ];

      mockGetItems.mockResolvedValue({
        items: itemsWithMissingStatus,
      });

      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });
    });

    it('handles missing teamId in route', async () => {
      mockGetItems.mockResolvedValue({ items: [] });

      render(
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/export/']}>
            <Routes>
              <Route path="/export/:teamId?" element={<ExportPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );

      // Should not call API without teamId
      await waitFor(() => {
        expect(mockGetItems).not.toHaveBeenCalled();
      });
    });
  });
});
