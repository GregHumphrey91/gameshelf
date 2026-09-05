import type { Game } from '@/types/game';

interface GameListProps {
  games: Game[];
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatAddedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export function GameList({ games, onEdit, onDelete }: GameListProps) {
  if (games.length === 0) {
    return (
      <p className="empty" data-testid="empty-state">
        No games yet. Add your first one above.
      </p>
    );
  }

  return (
    <table className="game-table" data-testid="game-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Platform</th>
          <th>Condition</th>
          <th>Est. value</th>
          <th>Added</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {games.map((game) => (
          <tr key={game.id} data-testid={`game-row-${game.id}`}>
            <td data-testid="game-title">{game.title}</td>
            <td>{game.platform}</td>
            <td>
              <span className={`badge badge--${game.condition.toLowerCase()}`}>{game.condition}</span>
            </td>
            <td>{currency.format(game.estimatedValue)}</td>
            <td>{formatAddedDate(game.addedDate)}</td>
            <td className="game-table__actions">
              <button type="button" onClick={() => onEdit(game)} data-testid="edit-game">
                Edit
              </button>
              <button type="button" onClick={() => onDelete(game)} data-testid="delete-game">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
