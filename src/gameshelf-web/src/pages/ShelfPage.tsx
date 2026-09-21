import { useState } from 'react';
import { AuthBar } from '@/components/AuthBar';
import { GameForm } from '@/components/GameForm';
import { GameList } from '@/components/GameList';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGames } from '@/hooks/useGames';
import type { Game, GameInput } from '@/types/game';

export function ShelfPage() {
  const auth = useAuth();
  const signedIn = auth.status === 'signed-in';

  // Who the API says we are decides what is rendered; the token only decides whether we get to ask.
  const { user, loading: userLoading, error: userError } = useCurrentUser(signedIn);
  const canRead = user?.role === 'Reader' || user?.role === 'Curator';
  const canEdit = user?.role === 'Curator';

  const { games, loading, error, create, update, remove } = useGames(canRead);
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
        <div>
          <h1>GameShelf</h1>
          {canRead && (
            <p className="app__summary" data-testid="summary">
              {games.length} {games.length === 1 ? 'game' : 'games'} ·{' '}
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}
            </p>
          )}
        </div>
        <AuthBar
          enabled={auth.enabled}
          status={auth.status}
          email={auth.email}
          role={user?.role}
          onSignIn={() => void auth.signIn()}
          onSignOut={() => void auth.signOut()}
        />
      </header>

      {auth.status === 'loading' || (signedIn && userLoading) ? (
        <p data-testid="loading">Loading…</p>
      ) : auth.status === 'signed-out' ? (
        <section className="card" data-testid="signed-out">
          <h2>Sign in to see the collection</h2>
          <p className="empty">Your games are only visible to signed-in accounts.</p>
          <button type="button" onClick={() => void auth.signIn()} data-testid="sign-in-cta">
            Sign in
          </button>
        </section>
      ) : userError ? (
        <p className="alert" role="alert" data-testid="error">
          {userError}
        </p>
      ) : !canRead ? (
        <section className="card" data-testid="no-access">
          <h2>No access yet</h2>
          <p className="empty">
            You are signed in as <strong data-testid="no-access-subject">{user?.email ?? user?.subject}</strong>, but
            this account has not been granted access. Ask a curator to add it.
          </p>
        </section>
      ) : (
        <>
          {canEdit && (
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
          )}

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
              <GameList games={games} canEdit={canEdit} onEdit={setEditing} onDelete={handleDelete} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
