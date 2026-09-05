import { useState } from 'react';
import { GameForm } from '@/components/GameForm';
import { GameList } from '@/components/GameList';
import { useGames } from '@/hooks/useGames';
import type { Game, GameInput } from '@/types/game';

export default function App() {
  const { games, loading, error, create, update, remove } = useGames();
  const [editing, setEditing] = useState<Game | null>(null);

  const totalValue = games.reduce((sum, g) => sum + g.estimatedValue, 0);

  async function handleUpdate(input: GameInput) {
    if (!editing) return;
    await update(editing.id, input);
    setEditing(null);
  }

  async function handleDelete(game: Game) {
    if (!window.confirm(`Delete "${game.title}"?`)) return;
    await remove(game.id).catch(() => undefined);
    if (editing?.id === game.id) setEditing(null);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>GameShelf</h1>
        <p className="app__summary" data-testid="summary">
          {games.length} {games.length === 1 ? 'game' : 'games'} ·{' '}
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}
        </p>
      </header>

      <section className="card">
        {editing ? (
          <>
            <h2>Edit “{editing.title}”</h2>
            <GameForm
              key={editing.id}
              initial={{
                title: editing.title,
                platform: editing.platform,
                condition: editing.condition,
                estimatedValue: editing.estimatedValue,
              }}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          </>
        ) : (
          <>
            <h2>Add a game</h2>
            <GameForm submitLabel="Add game" onSubmit={create} />
          </>
        )}
      </section>

      {error && (
        <p className="alert" role="alert" data-testid="error">
          {error}
        </p>
      )}

      <section className="card">
        <h2>Collection</h2>
        {loading ? (
          <p data-testid="loading">Loading…</p>
        ) : (
          <GameList games={games} onEdit={setEditing} onDelete={handleDelete} />
        )}
      </section>
    </main>
  );
}
