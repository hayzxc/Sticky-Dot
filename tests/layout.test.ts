import { describe, it, expect } from 'vitest';
import { clampPosition, clampSize } from '../src/content/layout';
import { CONFIG } from '../src/core/config';

const VIEWPORT = { width: 1024, height: 768 };

describe('Layout clamping', () => {
  it('keeps the widget fully inside the viewport', () => {
    const position = clampPosition(5000, 5000, 280, 400, VIEWPORT, 8);
    expect(position).toEqual({
      x: VIEWPORT.width - 280 - 8,
      y: VIEWPORT.height - 400 - 8,
    });
  });

  it('clamps negative positions to the margin', () => {
    expect(clampPosition(-100, -50, 280, 400, VIEWPORT, 8)).toEqual({ x: 8, y: 8 });
  });

  it('clamps panel size to configured minimum and viewport space', () => {
    expect(clampSize(10, 10, { left: 100, top: 12 }, VIEWPORT, 8)).toEqual({
      width: CONFIG.PANEL_MIN_WIDTH,
      height: CONFIG.PANEL_MIN_HEIGHT,
    });

    expect(clampSize(5000, 5000, { left: 100, top: 12 }, VIEWPORT, 8)).toEqual({
      width: Math.min(CONFIG.PANEL_MAX_WIDTH, VIEWPORT.width - 100 - 8),
      height: Math.min(CONFIG.PANEL_MAX_HEIGHT, VIEWPORT.height - 12 - 8),
    });
  });
});
