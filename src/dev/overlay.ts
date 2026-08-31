import type { Sample, Features, Classification } from '../types';

/**
 * Dev-only overlay (R1.3 verification hook): draws the sample buffer path and
 * the chosen features/classification so accuracy can be spot-checked against a
 * manual labeled set. Enabled via `?dev` in the URL.
 */
export function isDevMode(): boolean {
  return new URLSearchParams(location.search).has('dev');
}

export function createDevOverlay(): {
  render: (buf: Sample[], f: Features, c: Classification) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 220;
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    background: '#00000088',
    border: '1px solid #3a4152',
    borderRadius: '8px',
    zIndex: '10',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const render = (buf: Sample[], f: Features, c: Classification) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (buf.length > 1) {
      const xs = buf.map((s) => s.x);
      const ys = buf.map((s) => s.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const spanX = Math.max(1, Math.max(...xs) - minX);
      const spanY = Math.max(1, Math.max(...ys) - minY);
      ctx.strokeStyle = '#6ea8ff';
      ctx.beginPath();
      buf.forEach((s, i) => {
        const x = 10 + ((s.x - minX) / spanX) * 140;
        const y = 10 + ((s.y - minY) / spanY) * 120;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '11px monospace';
    const lines = [
      `shape: ${c.shape} (${c.confidence})`,
      `margin: ${c.margin.toFixed(2)}`,
      `axis: ${f.dominantAxis}`,
      `reversals: ${f.reversals}`,
      `peakV: ${f.peakVelocity.toFixed(2)}`,
      `straight: ${f.straightness.toFixed(2)}`,
      `pathLen: ${f.pathLength.toFixed(0)}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 8, 150 + i * 13));
  };

  return { render };
}
