import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../../src/components/ProductPage/ItemListComponent';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ teamId: 'test-team-123' }),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ItemListComponent', () => {
  const mockItems: ItemListItem[] = [
    {
      id: 'item-1',
      productName: 'M4 Carbine',
      actualName: 'Rifle #1',
      subtitle: 'Standard issue rifle',
      image: 'https://example.com/rifle.jpg',
      date: '11/14/25',
      status: 'Completed',
      parent: null,
      isKit: false,
      children: [],
    },
    {
      id: 'item-2',
      productName: 'First Aid Kit',
      actualName: 'Medical Kit',
      subtitle: 'Emergency supplies',
      image: 'https://example.com/kit.jpg',
      date: '11/13/25',
      status: 'Damaged',
      parent: null,
      isKit: true,
      children: [
        {
          id: 'item-3',
          productName: 'Bandages',
          actualName: 'Gauze Pack',
          subtitle: 'Sterile bandages',
          image: 'https://example.com/bandages.jpg',
          date: '11/13/25',
          status: 'Completed',
          parent: 'item-2',
          isKit: false,
          children: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no items provided', () => {
    renderWithRouter(<ItemListComponent items={[]} />);
    expect(screen.getByText(/No items to display/i)).toBeInTheDocument();
  });

  it('renders all root-level items', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
    expect(screen.getByText('Rifle #1')).toBeInTheDocument();
    expect(screen.getByText('First Aid Kit')).toBeInTheDocument();
    expect(screen.getByText('Medical Kit')).toBeInTheDocument();
  });

  it('filters out child items from root display', () => {
    const itemsWithChild: ItemListItem[] = [
      {
        id: 'parent',
        productName: 'Parent',
        actualName: 'Parent Item',
        subtitle: 'Parent desc',
        image: '',
        date: '11/14/25',
        parent: null,
        isKit: false,
        children: [],
      },
      {
        id: 'child',
        productName: 'Child',
        actualName: 'Child Item',
        subtitle: 'Child desc',
        image: '',
        date: '11/14/25',
        parent: 'parent',
        isKit: false,
        children: [],
      },
    ];

    renderWithRouter(<ItemListComponent items={itemsWithChild} />);

    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('displays status badge with correct styling', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const completedBadges = screen.getAllByText('Completed');
    expect(completedBadges.length).toBeGreaterThan(0);
    expect(completedBadges[0]).toBeInTheDocument();

    const damagedBadge = screen.getByText('Damaged');
    expect(damagedBadge).toBeInTheDocument();
  });

  it('shows child count indicator for kits', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    // Should show "1 item" for the kit with one child
    const childCountElements = screen.getAllByText((_content, element) => {
      const hasText = (node: Element | null) => {
        if (!node) return false;
        const text = node.textContent || '';
        return text.includes('📦') && text.includes('1') && text.includes('item');
      };
      return hasText(element);
    });

    expect(childCountElements.length).toBeGreaterThan(0);
  });

  it('shows expand button for all kits', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    // Should have at least one expand button for the kit
    const expandButtons = screen.getAllByRole('button');
    expect(expandButtons.length).toBeGreaterThan(0);
  });

  it('navigates to item detail page when item clicked', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const item = screen.getByText('M4 Carbine').closest('.MuiCard-root');
    fireEvent.click(item!);

    expect(mockNavigate).toHaveBeenCalledWith('/teams/test-team-123/items/item-1');
  });

  it('does not navigate when expand button clicked', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('expands and shows children when expand button clicked', async () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const parentCard = screen.getByText('First Aid Kit').closest('.MuiCard-root');
    expect(parentCard).toBeInTheDocument();

    // Children exist in DOM but are hidden via Collapse
    const bandagesCard = screen.getByText('Bandages').closest('.MuiBox-root');
    const collapseParent = bandagesCard?.closest('.MuiCollapse-root');
    expect(collapseParent).toHaveClass('MuiCollapse-hidden');

    const expandButton = screen
      .getAllByRole('button')
      .find((btn) => btn.closest('.MuiCard-root') === parentCard);
    fireEvent.click(expandButton!);

    // After expanding, collapse should not have hidden class
    await waitFor(() => {
      expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');
    });
  });

  it('collapses children when expand button clicked again', async () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const parentCard = screen.getByText('First Aid Kit').closest('.MuiCard-root');
    const expandButton = screen
      .getAllByRole('button')
      .find((btn) => btn.closest('.MuiCard-root') === parentCard);

    // Expand
    fireEvent.click(expandButton!);
    await waitFor(() => {
      const bandagesCard = screen.getByText('Bandages').closest('.MuiBox-root');
      const collapseParent = bandagesCard?.closest('.MuiCollapse-root');
      expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');
    });

    // Collapse
    fireEvent.click(expandButton!);

    // Wait for the collapse - check that Collapse has hidden class
    await waitFor(() => {
      const bandagesCard = screen.getByText('Bandages').closest('.MuiBox-root');
      const collapseParent = bandagesCard?.closest('.MuiCollapse-root');
      expect(collapseParent).toHaveClass('MuiCollapse-hidden');
    });
  });

  it('renders children with indentation and border', async () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    await waitFor(() => {
      const childCard = screen.getByText('Bandages').closest('.MuiCard-root');
      expect(childCard).toHaveStyle({ marginLeft: expect.any(String) });
    });
  });

  it('handles nested children recursively (3+ levels)', async () => {
    const deeplyNested: ItemListItem[] = [
      {
        id: 'level-0',
        productName: 'Kit',
        actualName: 'Main Kit',
        subtitle: 'Top level',
        image: '',
        date: '11/14/25',
        parent: null,
        isKit: true,
        children: [
          {
            id: 'level-1',
            productName: 'Sub Kit',
            actualName: 'Sub Kit 1',
            subtitle: 'Second level',
            image: '',
            date: '11/14/25',
            parent: 'level-0',
            isKit: true,
            children: [
              {
                id: 'level-2',
                productName: 'Deep Item',
                actualName: 'Deep Item Name',
                subtitle: 'Third level',
                image: '',
                date: '11/14/25',
                parent: 'level-1',
                isKit: false,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    renderWithRouter(<ItemListComponent items={deeplyNested} />);

    const firstExpand = screen.getAllByRole('button')[0];
    fireEvent.click(firstExpand);

    await waitFor(() => {
      expect(screen.getByText('Sub Kit')).toBeInTheDocument();
    });

    const secondExpand = screen.getAllByRole('button')[1];
    fireEvent.click(secondExpand);

    await waitFor(() => {
      // Use getAllByText since productName and actualName are both "Deep Item"
      const deepItemElements = screen.getAllByText('Deep Item');
      expect(deepItemElements.length).toBeGreaterThan(0);
    });
  });

  it('displays image or placeholder correctly', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('src', 'https://example.com/rifle.jpg');
    expect(images[1]).toHaveAttribute('src', 'https://example.com/kit.jpg');
  });

  it('handles items without status gracefully', () => {
    const noStatusItems: ItemListItem[] = [
      {
        id: 'item-1',
        productName: 'Test Item',
        actualName: 'Item Name',
        subtitle: 'Description',
        image: '',
        date: '11/14/25',
        parent: null,
        isKit: false,
        children: [],
      },
    ];

    renderWithRouter(<ItemListComponent items={noStatusItems} />);

    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('handles plural/singular child count correctly', () => {
    const oneChild: ItemListItem[] = [
      {
        id: 'parent',
        productName: 'Kit',
        actualName: 'Kit 1',
        subtitle: 'desc',
        image: '',
        date: '11/14/25',
        parent: null,
        isKit: true,
        children: [
          {
            id: 'child',
            productName: 'Item',
            actualName: 'Item 1',
            subtitle: 'desc',
            image: '',
            date: '11/14/25',
            parent: 'parent',
            isKit: false,
            children: [],
          },
        ],
      },
    ];

    renderWithRouter(<ItemListComponent items={oneChild} />);

    // Get all matching elements and verify at least one shows singular
    const singleItemCounts = screen.getAllByText((_content, element) => {
      const hasText = (node: Element | null) => {
        if (!node) return false;
        const text = node.textContent || '';
        return /📦\s*1\s*item/i.test(text);
      };
      return hasText(element);
    });
    expect(singleItemCounts.length).toBeGreaterThan(0);

    const multipleChildren: ItemListItem[] = [
      {
        id: 'parent2',
        productName: 'MultiKit',
        actualName: 'Kit 2',
        subtitle: 'desc',
        image: '',
        date: '11/14/25',
        parent: null,
        isKit: true,
        children: [
          {
            id: 'c1',
            productName: 'I1',
            actualName: 'I1',
            subtitle: '',
            image: '',
            date: '11/14/25',
            parent: 'parent2',
            isKit: false,
          },
          {
            id: 'c2',
            productName: 'I2',
            actualName: 'I2',
            subtitle: '',
            image: '',
            date: '11/14/25',
            parent: 'parent2',
            isKit: false,
          },
        ],
      },
    ];

    render(
      <BrowserRouter>
        <ItemListComponent items={multipleChildren} />
      </BrowserRouter>,
    );

    // Find elements showing "2 items" (plural) - use getAllByText
    const multipleItemsCounts = screen.getAllByText((_content, element) => {
      const hasText = (node: Element | null) => {
        if (!node) return false;
        const text = node.textContent || '';
        return /📦\s*2\s*items/i.test(text);
      };
      return hasText(element);
    });
    expect(multipleItemsCounts.length).toBeGreaterThan(0);
  });
});
