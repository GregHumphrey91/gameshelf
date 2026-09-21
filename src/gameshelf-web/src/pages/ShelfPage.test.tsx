import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_API_BASE } from '@/test/api';
import { FakeAuthClient, renderApp, SIGNED_IN, SIGNED_OUT } from '@/test/auth';
import { currentGames, seedGames, setCurrentUser } from '@/test/handlers';
import { server } from '@/test/server';

describe('ShelfPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the empty state after loading an empty collection', async () => {
    renderApp();

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('summary')).toHaveTextContent('0 games · $0.00');
  });

  it('adds a game and shows it in the collection', async () => {
    renderApp();
    await screen.findByTestId('empty-state');

    await userEvent.type(screen.getByTestId('input-title'), 'Hollow Knight');
    await userEvent.type(screen.getByTestId('input-platform'), 'Switch');
    await userEvent.clear(screen.getByTestId('input-value'));
    await userEvent.type(screen.getByTestId('input-value'), '25');
    await userEvent.click(screen.getByTestId('submit-game'));

    const row = await screen.findByTestId('game-row-1');
    expect(within(row).getByTestId('game-title')).toHaveTextContent('Hollow Knight');
    expect(screen.getByTestId('summary')).toHaveTextContent('1 game · $25.00');
  });

  it('edits an existing game', async () => {
    seedGames([{ title: 'Halo', platform: 'Xbox', condition: 'Fair', estimatedValue: 10 }]);
    renderApp();

    await userEvent.click(within(await screen.findByTestId('game-row-1')).getByTestId('edit-game'));
    expect(screen.getByRole('heading', { name: /edit “halo”/i })).toBeInTheDocument();

    const title = screen.getByTestId('input-title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Halo: Combat Evolved');
    await userEvent.click(screen.getByTestId('submit-game'));

    expect(await screen.findByText('Halo: Combat Evolved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add a game' })).toBeInTheDocument();
    expect(currentGames()[0].title).toBe('Halo: Combat Evolved');
  });

  it('deletes a game after confirmation', async () => {
    seedGames([{ title: 'Doom', platform: 'PC', condition: 'Poor', estimatedValue: 1 }]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp();

    await userEvent.click(within(await screen.findByTestId('game-row-1')).getByTestId('delete-game'));

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(currentGames()).toHaveLength(0);
  });

  it('does nothing when deletion is not confirmed', async () => {
    seedGames([{ title: 'Doom', platform: 'PC', condition: 'Poor', estimatedValue: 1 }]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp();

    await userEvent.click(within(await screen.findByTestId('game-row-1')).getByTestId('delete-game'));

    expect(screen.getByTestId('game-row-1')).toBeInTheDocument();
    expect(currentGames()).toHaveLength(1);
  });

  it('surfaces API errors', async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/games`, () => HttpResponse.json({ title: 'Database offline' }, { status: 503 })),
    );
    renderApp();

    expect(await screen.findByTestId('error')).toHaveTextContent('Database offline');
  });

  describe('in local mode', () => {
    it('labels the session and shows the role the API reports', async () => {
      renderApp();
      await screen.findByTestId('empty-state');

      expect(screen.getByTestId('auth-disabled')).toHaveTextContent('Local mode');
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Curator');
      expect(screen.queryByTestId('sign-in')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sign-out')).not.toBeInTheDocument();
    });
  });

  describe('with an identity provider', () => {
    it('shows only a sign-in prompt while signed out and never calls the API', async () => {
      const auth = new FakeAuthClient(SIGNED_OUT);
      const calls: string[] = [];
      server.events.on('request:start', ({ request }) => calls.push(new URL(request.url).pathname));

      renderApp(auth);

      expect(await screen.findByTestId('signed-out')).toBeInTheDocument();
      expect(screen.queryByTestId('summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('game-table')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('sign-in'));
      expect(auth.signIn).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByTestId('sign-in-cta'));
      expect(auth.signIn).toHaveBeenCalledTimes(2);
      expect(calls).toHaveLength(0);
    });

    it('shows a loading state until the session is known', async () => {
      const auth = new FakeAuthClient({ status: 'loading', email: null, name: null });
      renderApp(auth);

      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.queryByTestId('sign-in')).not.toBeInTheDocument();

      act(() => auth.setSession(SIGNED_IN));

      expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    });

    it('explains when a signed-in account has no access', async () => {
      setCurrentUser({ subject: '00u-unknown', email: 'stranger@example.com', role: null });
      const auth = new FakeAuthClient({ ...SIGNED_IN, email: 'stranger@example.com' });
      seedGames([{ title: 'Hidden', platform: 'PC', condition: 'Good', estimatedValue: 5 }]);

      renderApp(auth);

      const card = await screen.findByTestId('no-access');
      expect(within(card).getByTestId('no-access-subject')).toHaveTextContent('stranger@example.com');
      expect(screen.queryByTestId('game-table')).not.toBeInTheDocument();
      expect(screen.queryByTestId('summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('role-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('sign-out')).toBeInTheDocument();
    });

    it('gives readers a read-only collection', async () => {
      setCurrentUser({ subject: '00u-reader', email: 'player@example.com', role: 'Reader' });
      seedGames([{ title: 'Celeste', platform: 'Switch', condition: 'Mint', estimatedValue: 20 }]);

      renderApp(new FakeAuthClient());

      const row = await screen.findByTestId('game-row-1');
      expect(within(row).getByTestId('game-title')).toHaveTextContent('Celeste');
      expect(within(row).queryByTestId('edit-game')).not.toBeInTheDocument();
      expect(within(row).queryByTestId('delete-game')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Reader');
      expect(screen.getByTestId('user-email')).toHaveTextContent('player@example.com');
    });

    it('gives curators the full editor and a way out', async () => {
      setCurrentUser({ subject: '00u-curator', email: 'player@example.com', role: 'Curator' });
      const auth = new FakeAuthClient();

      renderApp(auth);

      await screen.findByTestId('empty-state');
      expect(screen.getByTestId('input-title')).toBeInTheDocument();
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Curator');

      await userEvent.click(screen.getByTestId('sign-out'));
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('surfaces a failure to load the account', async () => {
      server.use(http.get(`${TEST_API_BASE}/api/me`, () => new HttpResponse(null, { status: 401 })));

      renderApp(new FakeAuthClient());

      expect(await screen.findByTestId('error')).toHaveTextContent('You need to sign in to do that.');
    });
  });
});
