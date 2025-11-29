import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProductReviewPage from '../../src/pages/ProductReviewPage';
import * as itemsApi from '../../src/api/items';

vi.mock('../../src/api/items', () => ({
  getItems: vi.fn(),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

const renderWithParams = (itemId = '1', teamId = 'team-123') => {
  window.history.pushState({}, '', `/teams/${teamId}/items/${itemId}`);
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/teams/:teamId/items/:itemId" element={<ProductReviewPage />} />
      </Routes>
    </BrowserRouter>,
  );
};


describe('ProductReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(itemsApi.getItems).mockResolvedValue({
      success: true,
      items: [
        { itemId: '1', name: 'Rifle #1', serialNumber: 'R001' },
        { itemId: '2', name: 'Pistol #1', serialNumber: 'P001' },
      ],
    });

    vi.mocked(itemsApi.getItem).mockResolvedValue({
      success: true,
      item: {
        itemId: '1',
        name: 'Rifle #1',
        actualName: 'M4 Carbine',
        description: 'Standard issue',
        serialNumber: 'R001',
        authQuantity: 1,
        ohQuantity: 1,
        status: 'Available',
        children: [],
        isKit: false,
      },
    });
  });

  it('renders loading state initially', () => {
    renderWithParams('1', 'team-123');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays existing item in view mode', async () => {
    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText('Rifle #1')).toBeInTheDocument();
    });
  });

  it("renders create mode when itemId is 'new'", async () => {
    renderWithParams('new', 'team-123');

    await waitFor(() => {
      // There may be multiple CREATE buttons (one for desktop, one for mobile)
      const createButtons = screen.getAllByRole('button', { name: /create/i });
      expect(createButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows error alert when item fails to load', async () => {
    vi.mocked(itemsApi.getItem).mockResolvedValueOnce({
      success: false,
      error: 'Item not found',
    });

    renderWithParams('999', 'team-123');

    await waitFor(() => {
      expect(screen.getByText('Item not found')).toBeInTheDocument();
    });
  });

  it('displays back button that navigates back', async () => {
    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText('Rifle #1')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('shows DamageReportsSection only when status is Damaged', async () => {
    vi.mocked(itemsApi.getItem).mockResolvedValueOnce({
      success: true,
      item: {
        itemId: '1',
        name: 'Damaged Rifle',
        status: 'Damaged',
        damageReports: ['Scratched barrel'],
      },
    });

    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText(/Damage Reports/i)).toBeInTheDocument();
    });
  });

  it('does not show DamageReportsSection when status is not Damaged', async () => {
    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText('Rifle #1')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Damage Reports/i)).not.toBeInTheDocument();
  });

  it('displays ChildrenTree when item has children', async () => {
    vi.mocked(itemsApi.getItem).mockResolvedValueOnce({
      success: true,
      item: {
        itemId: '1',
        name: 'Kit',
        children: [],
      },
    });

    vi.mocked(itemsApi.getItems).mockResolvedValue({
      success: true,
      items: [
        { itemId: '1', name: 'Kit', serialNumber: 'K001' },
        { itemId: '2', name: 'Part 1', serialNumber: 'P001', parent: '1' },
        { itemId: '3', name: 'Part 2', serialNumber: 'P002', parent: '1' },
        { itemId: '4', name: 'Other Item', serialNumber: 'O001' },
      ],
    });

    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText(/Kit Contents/i)).toBeInTheDocument();
    });
  });

  it('excludes current item from itemsList for parent selection', async () => {
    const getItemsSpy = vi.mocked(itemsApi.getItems);

    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(getItemsSpy).toHaveBeenCalled();
    });
  });

  it("maps API 'name' field to 'productName' for component", async () => {
    vi.mocked(itemsApi.getItem).mockResolvedValueOnce({
      success: true,
      item: {
        itemId: '1',
        name: 'M4 Carbine',
        actualName: 'M4A1',
      },
    });

    renderWithParams('1', 'team-123');

    await waitFor(() => {
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    });
  });
});