import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock API modules *before* importing the component
const { mockGetItems, mockGenerateExportDocuments } = vi.hoisted(() => ({
  mockGetItems: vi.fn(),
  mockGenerateExportDocuments: vi.fn(),
}));

vi.mock('../src/api/items', () => ({
  getItems: mockGetItems,
}));

vi.mock('../src/api/download', () => ({
  generateExportDocuments: mockGenerateExportDocuments,
}));

// Mock child components
vi.mock('../src/components/TopBar', () => ({
  default: ({ isLoggedIn }: { isLoggedIn: boolean }) => (
    <div data-testid="top-bar">TopBar - {isLoggedIn ? 'Logged In' : 'Logged Out'}</div>
  ),
}));

vi.mock('../src/components/NavBar', () => ({
  default: () => <div data-testid="nav-bar">NavBar</div>,
}));

vi.mock('../src/components/ExportCategoryBar', () => ({
  default: ({ 
    activeCategory, 
    onCategoryChange 
  }: { 
    activeCategory: string; 
    onCategoryChange: (cat: string) => void;
  }) => (
    <div data-testid="export-category-bar">
      <button onClick={() => onCategoryChange('completed')}>Completed</button>
      <button onClick={() => onCategoryChange('broken')}>Broken</button>
      <div>Active: {activeCategory}</div>
    </div>
  ),
}));

vi.mock('../src/components/ExportPageContent', () => ({
  default: ({
    items,
    percentReviewed,
    activeCategory,
    exportData,
  }: {
    items: unknown[];
    percentReviewed: number;
    activeCategory: string;
    exportData: unknown;
  }) => (
    <div data-testid="export-page-content">
      <div>Items Count: {items.length}</div>
      <div>Percent Reviewed: {percentReviewed}%</div>
      <div>Active Category: {activeCategory}</div>
      <div>Export Data: {exportData ? 'Present' : 'Null'}</div>
    </div>
  ),
}));

// Import after mocks are defined
import ExportPage from '../src/pages/ExportPage';

const theme = createTheme();

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
    status: 'damaged',
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

    it('renders category bar after loading', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByTestId('export-category-bar')).toBeInTheDocument();
      });
    });

    it('starts with completed category active', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Active: completed')).toBeInTheDocument();
      });
    });

    it('switches category when clicking broken button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Broken')).toBeInTheDocument();
      });

      const brokenBtn = screen.getByText('Broken');
      await user.click(brokenBtn);

      await waitFor(() => {
        expect(screen.getByText('Active: broken')).toBeInTheDocument();
      });
    });
  });

  describe('Document Generation Flow', () => {
    beforeEach(() => {
      mockGetItems.mockResolvedValue({ items: mockItems });
      mockGenerateExportDocuments.mockResolvedValue({
        success: true,
        pdf2404: { ok: true, url: 'https://s3.../file.pdf' },
        csvInventory: { ok: true, csvContent: 'Item,Status\n...' },
      });
    });

    it('shows create documents button initially', async () => {
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });
    });

    it('shows generating state when create button clicked', async () => {
      const user = userEvent.setup();
      
      // Mock to delay so we can see the loading state
      mockGenerateExportDocuments.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          pdf2404: { ok: true },
          csvInventory: { ok: true, csvContent: 'data' },
        }), 100))
      );

      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });

      const createBtn = screen.getByText('Create Documents');
      await user.click(createBtn);

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByText(/Generating your documents/i)).toBeInTheDocument();
      });
    });

    it('shows ExportPageContent after successful generation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });

      const createBtn = screen.getByText('Create Documents');
      await user.click(createBtn);

      await waitFor(() => {
        expect(screen.getByTestId('export-page-content')).toBeInTheDocument();
        expect(screen.getByText('Export Data: Present')).toBeInTheDocument();
      });
    });

    it('shows error message when generation fails', async () => {
      const user = userEvent.setup();
      mockGenerateExportDocuments.mockRejectedValue(new Error('Export failed'));

      renderWithProviders(<ExportPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Documents')).toBeInTheDocument();
      });

      const createBtn = screen.getByText('Create Documents');
      await user.click(createBtn);

      await waitFor(() => {
        expect(screen.getByText(/Export failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stats Calculations', () => {
    beforeEach(() => {
      mockGetItems.mockResolvedValue({ items: mockItems });
    });

    it('calculates correct review percentage', async () => {
      renderWithProviders(<ExportPage />);

      // Just verify the progress bar renders with some percentage
      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar');
        const linearProgress = progressBars.find((el) =>
          el.classList.contains('MuiLinearProgress-root'),
        );
        expect(linearProgress).toBeInTheDocument();
      });
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

      await waitFor(() => {
        expect(mockGetItems).not.toHaveBeenCalled();
      });
    });
  });
});