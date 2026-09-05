import { useState, type FormEvent } from 'react';
import { GAME_CONDITIONS, type GameCondition, type GameInput } from '@/types/game';

interface GameFormProps {
  initial?: GameInput;
  submitLabel: string;
  onSubmit: (input: GameInput) => Promise<void>;
  onCancel?: () => void;
}

const EMPTY: GameInput = { title: '', platform: '', condition: 'Good', estimatedValue: 0 };

export function GameForm({ initial, submitLabel, onSubmit, onCancel }: GameFormProps) {
  const [values, setValues] = useState<GameInput>(initial ?? EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof GameInput>(key: K, value: GameInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        platform: values.platform.trim(),
      });
      if (!initial) setValues(EMPTY);
    } catch {
      // The hook surfaces the error; keep the form populated so the user can retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="game-form" onSubmit={handleSubmit} data-testid="game-form" aria-label={submitLabel}>
      <label>
        Title
        <input
          name="title"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          required
          maxLength={200}
          data-testid="input-title"
        />
      </label>

      <label>
        Platform
        <input
          name="platform"
          value={values.platform}
          onChange={(e) => set('platform', e.target.value)}
          required
          maxLength={100}
          data-testid="input-platform"
        />
      </label>

      <label>
        Condition
        <select
          name="condition"
          value={values.condition}
          onChange={(e) => set('condition', e.target.value as GameCondition)}
          data-testid="input-condition"
        >
          {GAME_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Estimated value ($)
        <input
          name="estimatedValue"
          type="number"
          min={0}
          step="0.01"
          value={values.estimatedValue}
          onChange={(e) => set('estimatedValue', Number(e.target.value))}
          data-testid="input-value"
        />
      </label>

      <div className="game-form__actions">
        <button type="submit" disabled={submitting} data-testid="submit-game">
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting} data-testid="cancel-edit">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
