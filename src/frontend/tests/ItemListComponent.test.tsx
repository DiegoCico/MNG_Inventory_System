import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ItemListComponent, { ItemListItem } from '../src/components/ItemListComponent';

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
      status: 'Found',
      parent: null,
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
      children: [
        {
          id: 'item-3',
          productName: 'Bandages',
          actualName: 'Gauze Pack',
          subtitle: 'Sterile bandages',
          image: 'https://example.com/bandages.jpg',
          date: '11/13/25',
          status: 'Found',
          parent: 'item-2',
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
        children: [],
      },
    ];

    renderWithRouter(<ItemListComponent items={itemsWithChild} />);

    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('displays status chip with correct color', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const foundChips = screen.getAllByText('Found');
    expect(foundChips[0]).toBeInTheDocument();
    expect(foundChips[0].closest('.MuiChip-root')).toHaveClass('MuiChip-colorDefault');

    const damagedChip = screen.getByText('Damaged');
    expect(damagedChip).toBeInTheDocument();
    expect(damagedChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
  });

  it('shows child count indicator for items with children', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    expect(screen.getByText(/📦 1 item/i)).toBeInTheDocument();
  });

  it('shows expand button only for items with children', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

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

  it('expands and shows children when expand button clicked', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const parentCard = screen.getByText('First Aid Kit').closest('.MuiCard-root');
    expect(parentCard).toBeInTheDocument();

    const bandagesText = screen.getByText('Bandages');
    const collapseParent = bandagesText.closest('.MuiCollapse-root');
    expect(collapseParent).toHaveClass('MuiCollapse-hidden');

    const expandButton = screen
      .getAllByRole('button')
      .find((btn) => btn.closest('.MuiCard-root') === parentCard);
    fireEvent.click(expandButton!);

    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');
  });

  it('collapses children when expand button clicked again', async () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const parentCard = screen.getByText('First Aid Kit').closest('.MuiCard-root');
    const expandButton = screen
      .getAllByRole('button')
      .find((btn) => btn.closest('.MuiCard-root') === parentCard);

    // Expand
    fireEvent.click(expandButton!);
    const bandagesText = screen.getByText('Bandages');
    const collapseParent = bandagesText.closest('.MuiCollapse-root');
    expect(collapseParent).not.toHaveClass('MuiCollapse-hidden');

    // Collapse
    fireEvent.click(expandButton!);

    // Wait for the collapse animation to complete
    await waitFor(() => {
      expect(collapseParent).toHaveClass('MuiCollapse-hidden');
    });
  });

  it('renders children with indentation and border', () => {
    renderWithRouter(<ItemListComponent items={mockItems} />);

    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);

    const childCard = screen.getByText('Bandages').closest('.MuiCard-root');

    expect(childCard).toHaveStyle({ marginLeft: expect.any(String) });
  });

  it('handles nested children recursively (3+ levels)', () => {
    const deeplyNested: ItemListItem[] = [
      {
        id: 'level-0',
        productName: 'Kit',
        actualName: 'Main Kit',
        subtitle: 'Top level',
        image: '',
        date: '11/14/25',
        parent: null,
        children: [
          {
            id: 'level-1',
            productName: 'Sub Kit',
            actualName: 'Sub Kit 1',
            subtitle: 'Second level',
            image: '',
            date: '11/14/25',
            parent: 'level-0',
            children: [
              {
                id: 'level-2',
                productName: 'Item',
                actualName: 'Deep Item',
                subtitle: 'Third level',
                image: '',
                date: '11/14/25',
                parent: 'level-1',
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
    expect(screen.getByText('Sub Kit')).toBeInTheDocument();

    const secondExpand = screen.getAllByRole('button')[1];
    fireEvent.click(secondExpand);
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Deep Item')).toBeInTheDocument();
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
        productName: 'Item',
        actualName: 'Item Name',
        subtitle: 'Description',
        image: '',
        date: '11/14/25',
        parent: null,
        children: [],
      },
    ];

    renderWithRouter(<ItemListComponent items={noStatusItems} />);

    expect(screen.getByText('Item')).toBeInTheDocument();
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
        children: [
          {
            id: 'child',
            productName: 'Item',
            actualName: 'Item 1',
            subtitle: 'desc',
            image: '',
            date: '11/14/25',
            parent: 'parent',
            children: [],
          },
        ],
      },
    ];

    renderWithRouter(<ItemListComponent items={oneChild} />);
    expect(screen.getByText(/📦 1 item$/i)).toBeInTheDocument();

    const multipleChildren: ItemListItem[] = [
      {
        id: 'parent',
        productName: 'Kit',
        actualName: 'Kit 1',
        subtitle: 'desc',
        image: '',
        date: '11/14/25',
        parent: null,
        children: [
          {
            id: 'c1',
            productName: 'I1',
            actualName: 'I1',
            subtitle: '',
            image: '',
            date: '11/14/25',
            parent: 'parent',
          },
          {
            id: 'c2',
            productName: 'I2',
            actualName: 'I2',
            subtitle: '',
            image: '',
            date: '11/14/25',
            parent: 'parent',
          },
        ],
      },
    ];

    render(
      <BrowserRouter>
        <ItemListComponent items={multipleChildren} />
      </BrowserRouter>,
    );
    expect(screen.getByText(/📦 2 items/i)).toBeInTheDocument();
  });
});
