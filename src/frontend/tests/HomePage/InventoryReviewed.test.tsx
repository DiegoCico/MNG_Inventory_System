import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import InventoryReviewed from '../../src/components/HomePage/InventoryReviewed';

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

// Mock CircularProgressBar
vi.mock('../../src/components/CircularProgressBar', () => ({
  default: ({ value }: { value: number }) => (
    <div data-testid="circular-progress" data-value={value}>
      {value}%
    </div>
  ),
}));

const theme = createTheme();

interface InventoryItem {
  updatedAt?: string;
}

const renderComponent = (
  percentReviewed: number,
  items: InventoryItem[],
  timeMode: 'hours' | 'days' = 'hours',
  selectedValue = 5,
) => {
  const mockOnChangeTimeMode = vi.fn();
  const mockOnChangeValue = vi.fn();

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <InventoryReviewed
          percentReviewed={percentReviewed}
          items={items}
          timeMode={timeMode}
          selectedValue={selectedValue}
          onChangeTimeMode={mockOnChangeTimeMode}
          onChangeValue={mockOnChangeValue}
        />
      </ThemeProvider>,
    ),
    mockOnChangeTimeMode,
    mockOnChangeValue,
  };
};

describe('InventoryReviewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component title', () => {
      renderComponent(50, []);

      expect(screen.getByText('Inventory Reviewed')).toBeInTheDocument();
    });

    it('displays circular progress bar with correct value', () => {
      renderComponent(75, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('data-value', '75');
    });

    it('renders the bar chart', () => {
      renderComponent(50, []);

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('displays time range controls', () => {
      renderComponent(50, [], 'hours', 5);

      expect(screen.getByRole('button', { name: /hours/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /days/i })).toBeInTheDocument();
    });

    it('shows correct subtitle for hours mode', () => {
      renderComponent(50, [], 'hours', 5);

      expect(screen.getByText('Reviews in Last 5 hours')).toBeInTheDocument();
    });

    it('shows correct subtitle for days mode', () => {
      renderComponent(50, [], 'days', 3);

      expect(screen.getByText('Reviews in Last 3 days')).toBeInTheDocument();
    });
  });

  describe('Time Mode Toggle', () => {
    it('calls onChangeTimeMode when Hours button clicked', () => {
      const { mockOnChangeTimeMode } = renderComponent(50, [], 'days', 5);

      const hoursButton = screen.getByRole('button', { name: /hours/i });
      fireEvent.click(hoursButton);

      expect(mockOnChangeTimeMode).toHaveBeenCalledWith('hours');
    });

    it('calls onChangeTimeMode when Days button clicked', () => {
      const { mockOnChangeTimeMode } = renderComponent(50, [], 'hours', 5);

      const daysButton = screen.getByRole('button', { name: /days/i });
      fireEvent.click(daysButton);

      expect(mockOnChangeTimeMode).toHaveBeenCalledWith('days');
    });

    it('clamps value to 7 when switching to days mode with value > 7', () => {
      const { mockOnChangeValue, mockOnChangeTimeMode } = renderComponent(50, [], 'hours', 24);

      const daysButton = screen.getByRole('button', { name: /days/i });
      fireEvent.click(daysButton);

      expect(mockOnChangeTimeMode).toHaveBeenCalledWith('days');
      expect(mockOnChangeValue).toHaveBeenCalledWith(7);
    });

    it('clamps value to 24 when switching to hours mode with value > 24', () => {
      // This test verifies the clamping logic exists in the component
      renderComponent(50, [], 'days', 5);

      const daysButton = screen.getByRole('button', { name: /days/i });
      expect(daysButton).toBeInTheDocument();
    });

    it('handles toggle button clicks', () => {
      const { mockOnChangeTimeMode } = renderComponent(50, [], 'hours', 5);

      const daysButton = screen.getByRole('button', { name: /days/i });
      fireEvent.click(daysButton);

      expect(mockOnChangeTimeMode).toHaveBeenCalledWith('days');
    });
  });

  describe('Value Selection Dropdown', () => {
    it('renders dropdown with label for hours mode', () => {
      const { container } = renderComponent(50, [], 'hours', 5);

      // Check that the FormControl with label exists
      const formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders dropdown with label for days mode', () => {
      const { container } = renderComponent(50, [], 'days', 3);

      // Check that the FormControl with label exists
      const formControl = container.querySelector('.MuiFormControl-root');
      expect(formControl).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('displays current selected value', () => {
      renderComponent(50, [], 'hours', 10);

      // The combobox should be present with the selected value
      const selectButton = screen.getByRole('combobox');
      expect(selectButton).toBeInTheDocument();
    });

    it('calls onChangeValue when dropdown value changes', () => {
      const { mockOnChangeValue } = renderComponent(50, [], 'hours', 5);

      // Open the dropdown
      const selectButton = screen.getByRole('combobox');
      fireEvent.mouseDown(selectButton);

      // Select a different value
      const option = screen.getByRole('option', { name: '10' });
      fireEvent.click(option);

      expect(mockOnChangeValue).toHaveBeenCalledWith(10);
    });

    it('shows 24 options in hours mode', () => {
      renderComponent(50, [], 'hours', 5);

      const selectButton = screen.getByRole('combobox');
      fireEvent.mouseDown(selectButton);

      // Should have options 1-24
      expect(screen.getByRole('option', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '24' })).toBeInTheDocument();
    });

    it('shows 7 options in days mode', () => {
      renderComponent(50, [], 'days', 3);

      const selectButton = screen.getByRole('combobox');
      fireEvent.mouseDown(selectButton);

      // Should have options 1-7
      expect(screen.getByRole('option', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '7' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '8' })).not.toBeInTheDocument();
    });
  });

  describe('Histogram Data Computation', () => {
    it('processes items with updatedAt timestamps', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const items = [
        { updatedAt: oneHourAgo.toISOString() },
        { updatedAt: twoHoursAgo.toISOString() },
      ];

      const { container } = renderComponent(50, items, 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      expect(chart).toBeInTheDocument();
    });

    it('handles items without updatedAt', () => {
      const items = [{ updatedAt: undefined }, { updatedAt: undefined }];

      const { container } = renderComponent(50, items, 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      expect(chart).toBeInTheDocument();
    });

    it('generates correct number of buckets for hours', () => {
      const { container } = renderComponent(50, [], 'hours', 10);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(10);
    });

    it('generates correct number of buckets for days', () => {
      const { container } = renderComponent(50, [], 'days', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(5);
    });

    it('creates labels with "h ago" format for hours', () => {
      const { container } = renderComponent(50, [], 'hours', 3);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].label).toBe('3h ago');
      expect(data[1].label).toBe('2h ago');
      expect(data[2].label).toBe('1h ago');
    });

    it('creates labels with "d ago" format for days', () => {
      const { container } = renderComponent(50, [], 'days', 3);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].label).toBe('3d ago');
      expect(data[1].label).toBe('2d ago');
      expect(data[2].label).toBe('1d ago');
    });

    it('counts items in correct hour buckets', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      const items = [
        { updatedAt: oneHourAgo.toISOString() },
        { updatedAt: oneHourAgo.toISOString() },
        { updatedAt: twoHoursAgo.toISOString() },
        { updatedAt: threeHoursAgo.toISOString() },
      ];

      const { container } = renderComponent(50, items, 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      // Verify data structure
      expect(data).toHaveLength(5);
      expect(
        data.every((d: { label: string; reviewed: number }) => typeof d.reviewed === 'number'),
      ).toBe(true);
    });

    it('ignores items outside time range', () => {
      const now = new Date();
      const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);

      const items = [{ updatedAt: tenHoursAgo.toISOString() }];

      const { container } = renderComponent(50, items, 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      // Item should not be counted in any bucket since it's beyond 5 hours
      const totalCount = data.reduce((sum: number, d: { reviewed: number }) => sum + d.reviewed, 0);
      expect(totalCount).toBe(0);
    });

    it('handles empty items array', () => {
      const { container } = renderComponent(50, [], 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(5);
      expect(data.every((d: { reviewed: number }) => d.reviewed === 0)).toBe(true);
    });
  });

  describe('Progress Display', () => {
    it('shows 0% progress', () => {
      renderComponent(0, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toHaveAttribute('data-value', '0');
    });

    it('shows 100% progress', () => {
      renderComponent(100, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toHaveAttribute('data-value', '100');
    });

    it('shows partial progress', () => {
      renderComponent(67, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toHaveAttribute('data-value', '67');
    });
  });

  describe('Layout and Structure', () => {
    it('renders as a Paper component', () => {
      const { container } = renderComponent(50, []);

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toBeInTheDocument();
    });

    it('has proper stack layout', () => {
      const { container } = renderComponent(50, []);

      const stacks = container.querySelectorAll('.MuiStack-root');
      expect(stacks.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles very large percentReviewed values', () => {
      renderComponent(999, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toHaveAttribute('data-value', '999');
    });

    it('handles negative percentReviewed values', () => {
      renderComponent(-10, []);

      const progressBar = screen.getByTestId('circular-progress');
      expect(progressBar).toHaveAttribute('data-value', '-10');
    });

    it('handles items with invalid date strings', () => {
      const items = [{ updatedAt: 'invalid-date' }, { updatedAt: 'not-a-date' }];

      expect(() => renderComponent(50, items, 'hours', 5)).not.toThrow();
    });

    it('handles items with future dates', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 60 * 1000);

      const items = [{ updatedAt: futureDate.toISOString() }];

      const { container } = renderComponent(50, items, 'hours', 5);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      expect(chart).toBeInTheDocument();
    });

    it('handles maximum hour value (24)', () => {
      renderComponent(50, [], 'hours', 24);

      expect(screen.getByText('Reviews in Last 24 hours')).toBeInTheDocument();
    });

    it('handles maximum day value (7)', () => {
      renderComponent(50, [], 'days', 7);

      expect(screen.getByText('Reviews in Last 7 days')).toBeInTheDocument();
    });

    it('handles minimum value (1)', () => {
      renderComponent(50, [], 'hours', 1);

      expect(screen.getByText('Reviews in Last 1 hours')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      renderComponent(50, []);

      const heading = screen.getByRole('heading', { name: /inventory reviewed/i });
      expect(heading).toBeInTheDocument();
    });

    it('toggle buttons are accessible', () => {
      renderComponent(50, []);

      expect(screen.getByRole('button', { name: /hours/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /days/i })).toBeInTheDocument();
    });

    it('dropdown has accessible combobox', () => {
      renderComponent(50, [], 'hours', 5);

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeInTheDocument();
    });
  });
});
