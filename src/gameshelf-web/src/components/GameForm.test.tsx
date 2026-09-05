import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameForm } from '@/components/GameForm';

describe('GameForm', () => {
  it('submits trimmed values and resets after adding', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GameForm submitLabel="Add game" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId('input-title'), '  Celeste  ');
    await userEvent.type(screen.getByTestId('input-platform'), ' Switch ');
    await userEvent.selectOptions(screen.getByTestId('input-condition'), 'Mint');
    await userEvent.clear(screen.getByTestId('input-value'));
    await userEvent.type(screen.getByTestId('input-value'), '19.99');
    await userEvent.click(screen.getByTestId('submit-game'));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Celeste', platform: 'Switch', condition: 'Mint', estimatedValue: 19.99 });
    expect(screen.getByTestId('input-title')).toHaveValue('');
  });

  it('pre-fills initial values in edit mode and keeps them after saving', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <GameForm
        initial={{ title: 'Halo', platform: 'Xbox', condition: 'Fair', estimatedValue: 12 }}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByTestId('input-title')).toHaveValue('Halo');
    expect(screen.getByTestId('input-condition')).toHaveValue('Fair');

    await userEvent.click(screen.getByTestId('submit-game'));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByTestId('input-title')).toHaveValue('Halo');
  });

  it('calls onCancel and only renders the cancel button when provided', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<GameForm submitLabel="Save" onSubmit={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByTestId('cancel-edit'));
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(<GameForm submitLabel="Add game" onSubmit={vi.fn()} />);
    expect(screen.queryByTestId('cancel-edit')).not.toBeInTheDocument();
  });

  it('keeps the entered values when submission fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('nope'));
    render(<GameForm submitLabel="Add game" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId('input-title'), 'Keep me');
    await userEvent.type(screen.getByTestId('input-platform'), 'PC');
    await userEvent.click(screen.getByTestId('submit-game'));

    expect(screen.getByTestId('input-title')).toHaveValue('Keep me');
    expect(screen.getByTestId('submit-game')).toBeEnabled();
  });
});
