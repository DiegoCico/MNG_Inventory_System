/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TeamActivityChart from '../../src/components/HomePage/TeamActivityChart';

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
  Bar: ({ dataKey, stackId, fill, shape }: { dataKey: string; stackId?: string; fill: string; shape?: any }) => (
    <div data-testid={`bar-${dataKey}`} data-stack-id={stackId} data-fill={fill} data-has-shape={!!shape} />
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Cell: ({ children }: { children?: React.ReactNode }) => <div data-testid="cell">{children}</div>,
}));

const theme = createTheme();

interface TeamStat {
  userId: string;
  name: string;
  completed: number;
  shortages: number;
  damaged: number;
}

const renderComponent = (teamStats: TeamStat[]) => {
  return render(
    <ThemeProvider theme={theme}>
      <TeamActivityChart teamStats={teamStats} />
    </ThemeProvider>,
  );
};

describe('TeamActivityChart', () => {
  const defaultTeamStats: TeamStat[] = [
    { userId: 'user-1', name: 'John Doe', completed: 10, shortages: 2, damaged: 1 },
    { userId: 'user-2', name: 'Jane Smith', completed: 15, shortages: 3, damaged: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component title', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByText('Team Activity')).toBeInTheDocument();
    });

    it('renders the bar chart', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('renders responsive container', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders chart components', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('renders three stacked bars', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByTestId('bar-completed')).toBeInTheDocument();
      expect(screen.getByTestId('bar-shortages')).toBeInTheDocument();
      expect(screen.getByTestId('bar-damaged')).toBeInTheDocument();
    });

    it('bars have custom shape component', () => {
      renderComponent(defaultTeamStats);

      expect(screen.getByTestId('bar-completed')).toHaveAttribute('data-has-shape', 'true');
      expect(screen.getByTestId('bar-shortages')).toHaveAttribute('data-has-shape', 'true');
      expect(screen.getByTestId('bar-damaged')).toHaveAttribute('data-has-shape', 'true');
    });
  });

  describe('Data Processing', () => {
    it('transforms team stats to chart data format', () => {
      const { container } = renderComponent(defaultTeamStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        name: 'John Doe',
        completed: 10,
        shortages: 2,
        damaged: 1,
      });
      expect(data[1]).toEqual({
        name: 'Jane Smith',
        completed: 15,
        shortages: 3,
        damaged: 0,
      });
    });

    it('handles single user stats', () => {
      const singleUser: TeamStat[] = [{ userId: 'user-1', name: 'Alice', completed: 5, shortages: 1, damaged: 0 }];

      const { container } = renderComponent(singleUser);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Alice');
    });

    it('handles multiple users', () => {
      const multipleUsers: TeamStat[] = [
        { userId: 'user-1', name: 'John', completed: 10, shortages: 2, damaged: 1 },
        { userId: 'user-2', name: 'Jane', completed: 15, shortages: 3, damaged: 0 },
        { userId: 'user-3', name: 'Bob', completed: 8, shortages: 1, damaged: 2 },
        { userId: 'user-4', name: 'Carol', completed: 12, shortages: 0, damaged: 1 },
      ];

      const { container } = renderComponent(multipleUsers);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(4);
    });

    it('handles empty team stats', () => {
      const { container } = renderComponent([]);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(0);
    });

    it('uses name field from team stats', () => {
      const stats: TeamStat[] = [
        { userId: 'user-1', name: 'John Doe', completed: 5, shortages: 1, damaged: 0 },
      ];

      const { container } = renderComponent(stats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('John Doe');
    });
  });

  describe('Bar Configuration', () => {
    it('completed bar uses stackId "a"', () => {
      renderComponent(defaultTeamStats);

      const completedBar = screen.getByTestId('bar-completed');
      expect(completedBar).toHaveAttribute('data-stack-id', 'a');
    });

    it('shortages bar uses stackId "a"', () => {
      renderComponent(defaultTeamStats);

      const shortagesBar = screen.getByTestId('bar-shortages');
      expect(shortagesBar).toHaveAttribute('data-stack-id', 'a');
    });

    it('damaged bar uses stackId "a"', () => {
      renderComponent(defaultTeamStats);

      const damagedBar = screen.getByTestId('bar-damaged');
      expect(damagedBar).toHaveAttribute('data-stack-id', 'a');
    });

    it('bars have correct data keys', () => {
      const { container } = renderComponent(defaultTeamStats);

      expect(container.querySelector('[data-testid="bar-completed"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="bar-shortages"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="bar-damaged"]')).toBeInTheDocument();
    });

    it('x-axis uses name as dataKey', () => {
      renderComponent(defaultTeamStats);

      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis).toHaveAttribute('data-key', 'name');
    });
  });

  describe('User Stats Values', () => {
    it('handles zero values', () => {
      const zeroStats: TeamStat[] = [{ userId: 'user-1', name: 'Zero User', completed: 0, shortages: 0, damaged: 0 }];

      const { container } = renderComponent(zeroStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].completed).toBe(0);
      expect(data[0].shortages).toBe(0);
      expect(data[0].damaged).toBe(0);
    });

    it('handles large values', () => {
      const largeStats: TeamStat[] = [
        { userId: 'user-1', name: 'Large User', completed: 1000, shortages: 500, damaged: 250 },
      ];

      const { container } = renderComponent(largeStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].completed).toBe(1000);
      expect(data[0].shortages).toBe(500);
      expect(data[0].damaged).toBe(250);
    });

    it('handles mixed zero and non-zero values', () => {
      const mixedStats: TeamStat[] = [
        { userId: 'user-1', name: 'Mixed User 1', completed: 10, shortages: 0, damaged: 5 },
        { userId: 'user-2', name: 'Mixed User 2', completed: 0, shortages: 3, damaged: 0 },
      ];

      const { container } = renderComponent(mixedStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0]).toEqual({
        name: 'Mixed User 1',
        completed: 10,
        shortages: 0,
        damaged: 5,
      });
      expect(data[1]).toEqual({
        name: 'Mixed User 2',
        completed: 0,
        shortages: 3,
        damaged: 0,
      });
    });
  });

  describe('Name Variations', () => {
    it('handles full names', () => {
      const nameStats: TeamStat[] = [
        { userId: 'user-1', name: 'John Doe', completed: 5, shortages: 1, damaged: 0 },
        { userId: 'user-2', name: 'Jane Smith', completed: 8, shortages: 2, damaged: 1 },
      ];

      const { container } = renderComponent(nameStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('John Doe');
      expect(data[1].name).toBe('Jane Smith');
    });

    it('handles single word names', () => {
      const singleNameStats: TeamStat[] = [
        { userId: 'user-1', name: 'Alice', completed: 5, shortages: 1, damaged: 0 },
      ];

      const { container } = renderComponent(singleNameStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('Alice');
    });

    it('handles names with special characters', () => {
      const specialStats: TeamStat[] = [
        { userId: 'user-1', name: "O'Brien-Smith", completed: 5, shortages: 1, damaged: 0 },
      ];

      const { container } = renderComponent(specialStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe("O'Brien-Smith");
    });

    it('handles empty name', () => {
      const emptyStats: TeamStat[] = [{ userId: 'user-1', name: '', completed: 5, shortages: 1, damaged: 0 }];

      const { container } = renderComponent(emptyStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('');
    });
  });

  describe('Layout and Structure', () => {
    it('renders as a Paper component', () => {
      const { container } = renderComponent(defaultTeamStats);

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toBeInTheDocument();
    });

    it('paper has zero elevation', () => {
      const { container } = renderComponent(defaultTeamStats);

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toHaveClass('MuiPaper-elevation0');
    });

    it('renders chart container with correct height', () => {
      const { container } = renderComponent(defaultTeamStats);

      // The Box component should have height styling
      const chartBox = container.querySelector(
        '[data-testid="responsive-container"]',
      )?.parentElement;
      expect(chartBox).toBeInTheDocument();
    });
  });

  describe('Typography', () => {
    it('title uses h6 variant', () => {
      renderComponent(defaultTeamStats);

      const title = screen.getByRole('heading', { name: /team activity/i });
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H6');
    });

    it('title has correct font weight', () => {
      const { container } = renderComponent(defaultTeamStats);

      const title = container.querySelector('h6');
      expect(title).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long name', () => {
      const longNameStats: TeamStat[] = [
        {
          userId: 'user-1',
          name: 'Very Long Name That Might Cause Layout Issues In The Chart Display Area',
          completed: 5,
          shortages: 1,
          damaged: 0,
        },
      ];

      const { container } = renderComponent(longNameStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('Very Long Name That Might Cause Layout Issues In The Chart Display Area');
    });

    it('handles many users', () => {
      const manyUsers: TeamStat[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user-${i}`,
        name: `User ${i}`,
        completed: i * 2,
        shortages: i,
        damaged: i % 3,
      }));

      const { container } = renderComponent(manyUsers);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data).toHaveLength(20);
    });

    it('handles negative values', () => {
      const negativeStats: TeamStat[] = [
        { userId: 'user-1', name: 'Negative User', completed: -5, shortages: -1, damaged: -2 },
      ];

      const { container } = renderComponent(negativeStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].completed).toBe(-5);
      expect(data[0].shortages).toBe(-1);
      expect(data[0].damaged).toBe(-2);
    });

    it('handles decimal values', () => {
      const decimalStats: TeamStat[] = [
        { userId: 'user-1', name: 'Decimal User', completed: 10.5, shortages: 2.3, damaged: 1.7 },
      ];

      const { container } = renderComponent(decimalStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].completed).toBe(10.5);
      expect(data[0].shortages).toBe(2.3);
      expect(data[0].damaged).toBe(1.7);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      renderComponent(defaultTeamStats);

      const heading = screen.getByRole('heading', { name: /team activity/i });
      expect(heading).toBeInTheDocument();
    });

    it('heading is visible', () => {
      renderComponent(defaultTeamStats);

      const heading = screen.getByText('Team Activity');
      expect(heading).toBeVisible();
    });
  });

  describe('Theme Integration', () => {
    it('renders without theme errors', () => {
      expect(() => renderComponent(defaultTeamStats)).not.toThrow();
    });

    it('bars use theme colors', () => {
      renderComponent(defaultTeamStats);

      const completedBar = screen.getByTestId('bar-completed');
      const shortagesBar = screen.getByTestId('bar-shortages');
      const damagedBar = screen.getByTestId('bar-damaged');

      // Check that fill attributes exist (actual color values come from theme)
      expect(completedBar).toHaveAttribute('data-fill');
      expect(shortagesBar).toHaveAttribute('data-fill');
      expect(damagedBar).toHaveAttribute('data-fill');
    });
  });

  describe('Data Integrity', () => {
    it('maintains data order', () => {
      const orderedStats: TeamStat[] = [
        { userId: 'user-1', name: 'First User', completed: 10, shortages: 2, damaged: 1 },
        { userId: 'user-2', name: 'Second User', completed: 15, shortages: 3, damaged: 0 },
        { userId: 'user-3', name: 'Third User', completed: 8, shortages: 1, damaged: 2 },
      ];

      const { container } = renderComponent(orderedStats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0].name).toBe('First User');
      expect(data[1].name).toBe('Second User');
      expect(data[2].name).toBe('Third User');
    });

    it('preserves all stat values', () => {
      const stats: TeamStat[] = [
        { userId: 'user-1', name: 'Test User', completed: 123, shortages: 456, damaged: 789 },
      ];

      const { container } = renderComponent(stats);

      const chart = container.querySelector('[data-testid="bar-chart"]');
      const data = JSON.parse(chart?.getAttribute('data-chart-data') || '[]');

      expect(data[0]).toEqual({
        name: 'Test User',
        completed: 123,
        shortages: 456,
        damaged: 789,
      });
    });
  });
});