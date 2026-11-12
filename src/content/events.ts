/**
 * Creates a debounced version of a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  waitMs: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Automatically adjusts textarea height based on content
 */
export function autoGrowTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  // scrollHeight includes padding
  textarea.style.height = `${Math.max(54, textarea.scrollHeight)}px`;
}
