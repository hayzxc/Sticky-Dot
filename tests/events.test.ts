import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../src/content/events';

describe('debounce', () => {
  it('reports pending state, cancels, and runs after the wait', () => {
    vi.useFakeTimers();

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    expect(debounced.isPending()).toBe(false);

    debounced();
    expect(debounced.isPending()).toBe(true);

    debounced.cancel();
    expect(debounced.isPending()).toBe(false);

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(debounced.isPending()).toBe(false);

    vi.useRealTimers();
  });
});
