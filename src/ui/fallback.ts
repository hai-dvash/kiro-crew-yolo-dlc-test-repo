import type { Shape } from '../types';

export interface FallbackCallbacks {
  onPick: (shape: Shape) => void;
  onRethrow: () => void;
}

/**
 * Accessibility fallback (NFR3, R1.2): three always-visible buttons that inject
 * a shape into the same downstream path as a gesture, plus a low-confidence
 * badge that doubles as a one-click re-throw affordance.
 */
export function attachFallback(
  container: HTMLElement,
  badge: HTMLElement,
  cb: FallbackCallbacks,
): () => void {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-shape]'));

  const onClick = (e: Event) => {
    const shape = (e.currentTarget as HTMLButtonElement).dataset.shape as Shape;
    if (shape) cb.onPick(shape);
  };
  buttons.forEach((b) => b.addEventListener('click', onClick));

  const onBadge = () => cb.onRethrow();
  badge.addEventListener('click', onBadge);

  return () => {
    buttons.forEach((b) => b.removeEventListener('click', onClick));
    badge.removeEventListener('click', onBadge);
  };
}

export function showBadge(badge: HTMLElement, show: boolean): void {
  badge.classList.toggle('show', show);
  if (show) badge.style.cursor = 'pointer';
}
