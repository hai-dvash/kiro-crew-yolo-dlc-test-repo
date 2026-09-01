// T17 [F5] — a11y fallback controls (R5.3, NFR3).
// Keyboard-operable R/P/S controls that emit the SAME GestureResult into the
// SAME round path (confidence=1, lowConfidence=false) — one code path, WCAG 2.1 AA.
import type { Shape, GestureResult } from './../types';

const KEY_MAP: Record<string, Shape> = {
  r: 'rock',
  p: 'paper',
  s: 'scissors',
};

export interface FallbackControls {
  element: HTMLElement;
  dispose(): void;
}

/** Build accessible buttons + keyboard handler that feed `emit`. */
export function createFallback(emit: (r: GestureResult) => void): FallbackControls {
  const nav = document.createElement('div');
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', 'Choose your throw');
  nav.className = 'a11y-controls';

  const shapes: Shape[] = ['rock', 'paper', 'scissors'];
  const buttons: HTMLButtonElement[] = [];
  for (const shape of shapes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = shape[0].toUpperCase() + shape.slice(1);
    btn.setAttribute('aria-label', `Throw ${shape}`);
    btn.setAttribute('data-shape', shape);
    btn.addEventListener('click', () => submit(shape));
    nav.appendChild(btn);
    buttons.push(btn);
  }

  function submit(shape: Shape): void {
    emit({ shape, confidence: 1, lowConfidence: false, latencyMs: 0 });
  }

  function onKey(e: KeyboardEvent): void {
    const shape = KEY_MAP[e.key.toLowerCase()];
    if (shape) {
      e.preventDefault();
      submit(shape);
    }
  }
  window.addEventListener('keydown', onKey);

  return {
    element: nav,
    dispose: () => window.removeEventListener('keydown', onKey),
  };
}
