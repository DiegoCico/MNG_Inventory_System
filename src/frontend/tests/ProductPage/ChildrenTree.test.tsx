import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChildrenTree from '../../src/components/ProductPage/ChildrenTree';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ChildrenTree', () => {
  const teamId = 'test-team-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when editedProduct has no children', () => {
    const { container } = renderWithRouter(
      <ChildrenTree editedProduct={{ children: [] }} teamId={teamId} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when editedProduct is null', () => {
    const { container } = renderWithRouter(<ChildrenTree editedProduct={null} teamId={teamId} />);

    expect(container.firstChild).toBeNull();
  });

  it('returns null when children is undefined', () => {
    const { container } = renderWithRouter(<ChildrenTree editedProduct={{}} teamId={teamId} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders kit contents header with correct count', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Found' },
        { itemId: 'child-2', name: 'Item 2', actualName: 'Child 2', status: 'Incomplete' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    expect(screen.getByText(/📦 Kit Contents \(2 items\)/i)).toBeInTheDocument();
  });

  it("uses singular 'item' for one child", () => {
    const productOneChild = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', status: 'Found' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productOneChild} teamId={teamId} />);

    expect(screen.getByText(/📦 Kit Contents \(1 item\)$/i)).toBeInTheDocument();
  });

  it('renders all child items with correct names', () => {
    const productWithChildren = {
      children: [
        { itemId: 'child-1', name: 'Bandages', actualName: 'Gauze Pack', status: 'Found' },
        {
          itemId: 'child-2',
          name: 'Scissors',
          actualName: 'Medical Scissors',
          status: 'Incomplete',
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    expect(screen.getByText(/├─ Bandages/i)).toBeInTheDocument();
    expect(screen.getByText(/Gauze Pack/i)).toBeInTheDocument();
    expect(screen.getByText(/├─ Scissors/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical Scissors/i)).toBeInTheDocument();
  });

  it('displays status chips with correct colors', () => {
    const productWithChildren = {
      children: [
        { itemId: 'c1', name: 'Item 1', status: 'Completed' },
        { itemId: 'c2', name: 'Item 2', status: 'Damaged' },
        { itemId: 'c3', name: 'Item 3', status: 'Shortages' },
        { itemId: 'c4', name: 'Item 4', status: 'To Review' },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    const completedChip = screen.getByText('Completed');
    expect(completedChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');

    const damagedChip = screen.getByText('Damaged');
    expect(damagedChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');

    const shortagesChip = screen.getByText('Shortages');
    expect(shortagesChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
  });

  it('navigates to child item when clicked', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    const childCard = screen.getByText(/├─ Item 1/i).closest('.MuiCard-root');
    fireEvent.click(childCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/teams/test-team-123/items/child-1');
  });

  it('shows expand button for children with sub-children', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          actualName: 'Sub Kit 1',
          children: [{ itemId: 'grandchild-1', name: 'Item', actualName: 'Deep Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} teamId={teamId} />);

    const expandButton = screen.getByRole('button');
    expect(expandButton).toBeInTheDocument();
  });

  it('does not show expand button for children without sub-children', () => {
    const productNoNesting = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1', children: [] }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNoNesting} teamId={teamId} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('expands to show grandchildren when expand clicked', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Deep Item', actualName: 'Item 1' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} teamId={teamId} />);

    // Check that collapse is hidden initially
    const deepItemElements = screen.getAllByText(/Deep Item/i);
    const collapseParent = deepItemElements[0].closest('.MuiCollapse-root');
    expect(collapseParent).toHaveClass('MuiCollapse-hidden');

    // Click expand
    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    // Grandchild now visible (collapse no longer hidden)
    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');
  });

  it('collapses grandchildren when collapse clicked', async () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Deep Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} teamId={teamId} />);

    const expandButton = screen.getByRole('button');

    // Expand
    fireEvent.click(expandButton);
    const deepItemElements = screen.getAllByText(/Deep Item/i);
    const collapseParent = deepItemElements[0].closest('.MuiCollapse-root');
    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');

    // Collapse
    fireEvent.click(expandButton);
    await waitFor(() => {
      expect(collapseParent).toHaveClass('MuiCollapse-hidden');
    });
  });

  it('does not navigate when expand button clicked', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Sub Kit',
          children: [{ itemId: 'grandchild-1', name: 'Item' }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} teamId={teamId} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles deeply nested children (4+ levels)', () => {
    const deepNested = {
      children: [
        {
          itemId: 'l1',
          name: 'Level 1',
          children: [
            {
              itemId: 'l2',
              name: 'Level 2',
              children: [
                {
                  itemId: 'l3',
                  name: 'Level 3',
                  children: [{ itemId: 'l4', name: 'Level 4', children: [] }],
                },
              ],
            },
          ],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={deepNested} teamId={teamId} />);

    // Expand all levels
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => fireEvent.click(btn));

    const level4Elements = screen.getAllByText(/Level 4/i);
    expect(level4Elements.length).toBeGreaterThan(0);
  });

  it('applies correct indentation at different levels', () => {
    const productNested = {
      children: [
        {
          itemId: 'child-1',
          name: 'Level 1',
          children: [{ itemId: 'grandchild-1', name: 'Level 2', children: [] }],
        },
      ],
    };

    renderWithRouter(<ChildrenTree editedProduct={productNested} teamId={teamId} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    // Level 2 card should have left margin - use getAllByText since text appears twice
    const level2Elements = screen.getAllByText(/Level 2/i);
    const level2Card = level2Elements[0].closest('.MuiCard-root');
    expect(level2Card).toHaveStyle({ marginLeft: expect.any(String) });
  });

  it('uses fallback to name when actualName is missing', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item Name Only', actualName: undefined }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    const nameElements = screen.getAllByText(/Item Name Only/i);
    expect(nameElements.length).toBeGreaterThan(0);
  });

  it('handles children without status field', () => {
    const productWithChildren = {
      children: [{ itemId: 'child-1', name: 'Item 1', actualName: 'Child 1' }],
    };

    renderWithRouter(<ChildrenTree editedProduct={productWithChildren} teamId={teamId} />);

    expect(screen.getByText(/Item 1/i)).toBeInTheDocument();
  });
});
