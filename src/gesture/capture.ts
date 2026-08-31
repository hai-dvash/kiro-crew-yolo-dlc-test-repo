import type { Sample, Classification } from '../types';
import { extractFeatures } from './features';
import { classify } from './classify';

export interface CaptureCallbacks {
  onStart?: () => void;
  onClassified?: (result: Classification, buffer: Sample[]) => void;
}

/**
 * Press-and-hold-then-flick capture (design decision 1): pointerdown opens a
 * deterministic window, pointermove samples {t,x,y} (throttled to frames),
 * pointerup closes it, extracts features and classifies (R1.1, R1.2).
 */
export function attachCapture(el: HTMLElement, cb: CaptureCallbacks): () => void {
  let buffer: Sample[] = [];
  let capturing = false;
  let rafPending = false;
  let pending: Sample | null = null;

  const flush = () => {
    rafPending = false;
    if (pending) {
      buffer.push(pending);
      pending = null;
    }
  };

  const onDown = (e: PointerEvent) => {
    capturing = true;
    buffer = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    el.setPointerCapture?.(e.pointerId);
    cb.onStart?.();
  };

  const onMove = (e: PointerEvent) => {
    if (!capturing) return;
    pending = { t: performance.now(), x: e.clientX, y: e.clientY };
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(flush);
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!capturing) return;
    capturing = false;
    if (pending) {
      buffer.push(pending);
      pending = null;
    }
    buffer.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    el.releasePointerCapture?.(e.pointerId);
    const features = extractFeatures(buffer);
    const result = classify(features);
    cb.onClassified?.(result, buffer.slice());
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
  };
}
