import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatAddedDate, GameList } from '@/components/GameList';
import type { Game } from '@/types/game';

const games: Game[] = [
  { id: 1, title: 'Chrono Trigger', platform: 'SNES', condition: 'Good', estimatedValue: 120, addedDate: '2026-09-01T00:00:00Z' },
  { id: 2, title: 'Ico', platform: 'PS2', condition: 'Mint', estimatedValue: 45.5, addedDate: '2026-09-02T00:00:00Z' },
];

describe('GameList', () => {
  it('renders the empty state when there are no games', () => {
    render(<GameList games={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('game-table')).not.toBeInTheDocument();
  });

  it('renders one row per game with formatted values', () => {
    render(<GameList games={games} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const row = within(screen.getByTestId('game-row-2'));
    expect(row.getByTestId('game-title')).toHaveTextContent('Ico');
    expect(row.getByText('$45.50')).toBeInTheDocument();
    expect(row.getByText('Mint')).toHaveClass('badge--mint');
    expect(row.getByText('9/2/2026')).toBeInTheDocument();
  });

  it('invokes callbacks with the clicked game', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<GameList games={games} onEdit={onEdit} onDelete={onDelete} />);

    await userEvent.click(within(screen.getByTestId('game-row-1')).getByTestId('edit-game'));
    await userEvent.click(within(screen.getByTestId('game-row-2')).getByTestId('delete-game'));

    expect(onEdit).toHaveBeenCalledWith(games[0]);
    expect(onDelete).toHaveBeenCalledWith(games[1]);
  });

  it('hides the action buttons when editing is not allowed', () => {
    render(<GameList games={games} canEdit={false} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByTestId('edit-game')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-game')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument();
  });

  it('words the empty state for read-only viewers', () => {
    render(<GameList games={[]} canEdit={false} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No games in the collection yet.');
  });
});

describe('formatAddedDate', () => {
  it('formats ISO timestamps as US dates in UTC', () => {
    expect(formatAddedDate('2026-12-31T23:59:00Z')).toBe('12/31/2026');
  });

  it('returns a dash for unparseable input', () => {
    expect(formatAddedDate('not a date')).toBe('—');
  });
});
