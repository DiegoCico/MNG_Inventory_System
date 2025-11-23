import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RestartInventoryCard from '../../src/components/HomePage/RestartInventoryCard';

// Mock the RestartProcess component
vi.mock('../../src/components/RestartProcess', () => ({
  default: ({ teamId, onRestart }: { teamId: string; onRestart: () => void }) => (
    <div data-testid="restart-process">
      <span>Team ID: {teamId}</span>
      <button onClick={onRestart}>Restart</button>
    </div>
  ),
}));

const theme = createTheme();

const renderComponent = (teamId: string) => {
  return render(
    <ThemeProvider theme={theme}>
      <RestartInventoryCard teamId={teamId} />
    </ThemeProvider>,
  );
};

describe('RestartInventoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.reload
    delete (window as { location?: Location }).location;
    window.location = { reload: vi.fn() } as unknown as Location;
  });

  describe('Rendering', () => {
    it('renders the RestartProcess component', () => {
      renderComponent('team-123');

      expect(screen.getByTestId('restart-process')).toBeInTheDocument();
    });

    it('passes teamId to RestartProcess', () => {
      renderComponent('team-456');

      expect(screen.getByText('Team ID: team-456')).toBeInTheDocument();
    });

    it('passes different teamId correctly', () => {
      renderComponent('engineering-team');

      expect(screen.getByText('Team ID: engineering-team')).toBeInTheDocument();
    });
  });

  describe('Restart Functionality', () => {
    it('calls window.location.reload when restart button clicked', () => {
      renderComponent('team-123');

      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);

      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('reloads page on multiple clicks', () => {
      renderComponent('team-123');

      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);
      fireEvent.click(restartButton);
      fireEvent.click(restartButton);

      expect(window.location.reload).toHaveBeenCalledTimes(3);
    });

    it('passes onRestart callback to RestartProcess', () => {
      const { container } = renderComponent('team-123');

      // Verify the component renders with the restart functionality
      expect(container.querySelector('[data-testid="restart-process"]')).toBeInTheDocument();

      const restartButton = screen.getByRole('button', { name: /restart/i });
      expect(restartButton).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('handles empty string teamId', () => {
      renderComponent('');

      expect(screen.getByText('Team ID:')).toBeInTheDocument();
    });

    it('handles teamId with special characters', () => {
      renderComponent('team-123_abc');

      expect(screen.getByText('Team ID: team-123_abc')).toBeInTheDocument();
    });

    it('handles teamId with spaces', () => {
      renderComponent('team 123');

      expect(screen.getByText('Team ID: team 123')).toBeInTheDocument();
    });

    it('handles very long teamId', () => {
      const longTeamId = 'very-long-team-id-that-might-cause-issues-123456789';
      renderComponent(longTeamId);

      expect(screen.getByText(`Team ID: ${longTeamId}`)).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('renders without errors', () => {
      expect(() => renderComponent('team-123')).not.toThrow();
    });

    it('maintains teamId prop after render', () => {
      const { rerender } = render(
        <ThemeProvider theme={theme}>
          <RestartInventoryCard teamId="team-123" />
        </ThemeProvider>,
      );

      expect(screen.getByText('Team ID: team-123')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <RestartInventoryCard teamId="team-456" />
        </ThemeProvider>,
      );

      expect(screen.getByText('Team ID: team-456')).toBeInTheDocument();
    });
  });

  describe('Window Location', () => {
    it('calls reload without arguments', () => {
      renderComponent('team-123');

      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);

      expect(window.location.reload).toHaveBeenCalledWith();
    });

    it('does not navigate to a different page', () => {
      const reloadSpy = vi.fn();
      window.location.reload = reloadSpy;

      renderComponent('team-123');

      const restartButton = screen.getByRole('button', { name: /restart/i });
      fireEvent.click(restartButton);

      expect(reloadSpy).toHaveBeenCalled();
      // Verify it's a reload, not a navigation
      expect(reloadSpy).not.toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('Accessibility', () => {
    it('restart button is accessible', () => {
      renderComponent('team-123');

      const button = screen.getByRole('button', { name: /restart/i });
      expect(button).toBeInTheDocument();
    });

    it('button is clickable', () => {
      renderComponent('team-123');

      const button = screen.getByRole('button', { name: /restart/i });
      expect(button).toBeEnabled();
    });
  });

  describe('Edge Cases', () => {
    it('handles multiple rapid clicks', () => {
      renderComponent('team-123');

      const restartButton = screen.getByRole('button', { name: /restart/i });

      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        fireEvent.click(restartButton);
      }

      expect(window.location.reload).toHaveBeenCalledTimes(10);
    });

    it('works with numeric teamId', () => {
      renderComponent('12345');

      expect(screen.getByText('Team ID: 12345')).toBeInTheDocument();
    });

    it('works with teamId containing special URL characters', () => {
      renderComponent('team?id=123&foo=bar');

      expect(screen.getByText('Team ID: team?id=123&foo=bar')).toBeInTheDocument();
    });
  });
});
