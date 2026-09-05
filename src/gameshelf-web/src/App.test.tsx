import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { TEST_API_BASE } from '@/test/api';
import { currentGames, seedGames } from '@/test/handlers';
import { server } from '@/test/server';

describe('App', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the empty state after loading an empty collection', async () => {
    render(<App />);

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('summary')).toHaveTextContent('0 games · $0.00');
  });

  it('adds a game and shows it in the collection', async () => {
    render(<App />);
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
    render(<App />);

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
    render(<App />);

    await userEvent.click(within(await screen.findByTestId('game-row-1')).getByTestId('delete-game'));

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(currentGames()).toHaveLength(0);
  });

  it('does nothing when deletion is not confirmed', async () => {
    seedGames([{ title: 'Doom', platform: 'PC', condition: 'Poor', estimatedValue: 1 }]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await userEvent.click(within(await screen.findByTestId('game-row-1')).getByTestId('delete-game'));

    expect(screen.getByTestId('game-row-1')).toBeInTheDocument();
    expect(currentGames()).toHaveLength(1);
  });

  it('surfaces API errors', async () => {
    server.use(http.get(`${TEST_API_BASE}/api/games`, () => HttpResponse.json({ title: 'Database offline' }, { status: 503 })));
    render(<App />);

    expect(await screen.findByTestId('error')).toHaveTextContent('Database offline');
  });
});
