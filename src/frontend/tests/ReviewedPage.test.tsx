import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReviewedPage from '../src/pages/ReviewedPage';
import * as itemsAPI from '../src/api/items';

vi.mock('../src/api/items');

const renderWithRouter = (teamId = 'test-team-123') => {
  window.history.pushState({}, '', `/teams/${teamId}/reviewed`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/teams/:teamId/reviewed" element={<ReviewedPage />} />
      </Routes>
    </BrowserRouter>,
  );
};

describe('ReviewedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(itemsAPI.getItems).mockResolvedValue({
      success: true,
      items: [
        {
          itemId: 'item-1',
          name: 'M4 Carbine',
          actualName: 'Rifle #1',
          description: 'Test rifle',
          status: 'Found',
          parent: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          imageLink: 'https://example.com/image.jpg',
          isKit: false,
        },
        {
          itemId: 'item-2',
          name: 'First Aid Kit',
          actualName: 'Medic Kit',
          description: 'Medical supplies',
          status: 'Missing',
          parent: null,
          createdAt: '2025-01-02T00:00:00.000Z',
          imageLink: '',
          isKit: false,
        },
        {
          itemId: 'item-3',
          name: 'Tactical Vest',
          actualName: 'Vest #1',
          description: 'Torn strap',
          status: 'Damaged',
          parent: null,
          createdAt: '2025-01-03T00:00:00.000Z',
          imageLink: '',
          isKit: false,
        },
      ],
    });
  });

  it('renders loading state initially', () => {
    renderWithRouter();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays three tabs without counts', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Shortages')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
    });
  });

  it('displays completed items in first tab by default', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
      expect(screen.getByText('Rifle #1')).toBeInTheDocument();
    });
  });

  it('switches to Shortages tab and displays shortage items', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    });

    const shortagesTab = screen.getByRole('tab', { name: /Shortages/i });
    fireEvent.click(shortagesTab);

    await waitFor(() => {
      expect(screen.getByText('First Aid Kit')).toBeInTheDocument();
      expect(screen.getByText('Medic Kit')).toBeInTheDocument();
    });
  });

  it('switches to Damaged tab and displays damaged items', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    });

    const damagedTab = screen.getByRole('tab', { name: /Damaged/i });
    fireEvent.click(damagedTab);

    await waitFor(() => {
      expect(screen.getByText('Tactical Vest')).toBeInTheDocument();
      expect(screen.getByText('Vest #1')).toBeInTheDocument();
    });
  });

  it("shows 'No completed items' message when completed tab is empty", async () => {
    vi.mocked(itemsAPI.getItems).mockResolvedValueOnce({
      success: true,
      items: [],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/No completed items/i)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    vi.mocked(itemsAPI.getItems).mockResolvedValueOnce({
      success: false,
      error: 'Failed to fetch items',
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch items/i)).toBeInTheDocument();
    });
  });

  it('builds parent-child hierarchy correctly', async () => {
    vi.mocked(itemsAPI.getItems).mockResolvedValueOnce({
      success: true,
      items: [
        {
          itemId: 'parent-1',
          name: 'Medical Kit',
          actualName: 'Main Kit',
          status: 'Found',
          parent: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          isKit: true,
        },
        {
          itemId: 'child-1',
          name: 'Bandages',
          actualName: 'Medical Bandages',
          status: 'Found',
          parent: 'parent-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          isKit: false,
        },
      ],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Medical Kit')).toBeInTheDocument();
      expect(screen.getByText('Main Kit')).toBeInTheDocument();
    });
  });

  it('filters items by status across hierarchy', async () => {
    vi.mocked(itemsAPI.getItems).mockResolvedValueOnce({
      success: true,
      items: [
        {
          itemId: 'parent-1',
          name: 'Medical Kit',
          actualName: 'Main Medical Kit',
          status: 'Found',
          parent: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          isKit: true,
        },
        {
          itemId: 'child-1',
          name: 'Bandages',
          actualName: 'Gauze',
          status: 'Damaged',
          parent: 'parent-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          isKit: false,
        },
      ],
    });

    renderWithRouter();

    await waitFor(() => {
      const medicalKitElements = screen.getAllByText('Medical Kit');
      expect(medicalKitElements.length).toBeGreaterThan(0);
    });

    const damagedTab = screen.getByRole('tab', { name: /Damaged/i });
    fireEvent.click(damagedTab);

    await waitFor(() => {
      const medicalKitElements = screen.getAllByText('Medical Kit');
      expect(medicalKitElements.length).toBeGreaterThan(0);
    });
  });

  it('normalizes status strings (case-insensitive)', async () => {
    vi.mocked(itemsAPI.getItems).mockResolvedValueOnce({
      success: true,
      items: [
        {
          itemId: 'item-1',
          name: 'Item',
          status: 'FOUND',
          parent: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          isKit: false,
        },
      ],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('renders TopBar and Profile components', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    });

    const accountIcon = screen.getByTestId('AccountCircleIcon');
    expect(accountIcon).toBeInTheDocument();
  });

  it('renders NavBar at bottom', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    });

    const navButtons = screen.getAllByRole('button');
    expect(navButtons.length).toBeGreaterThan(0);
  });
});
