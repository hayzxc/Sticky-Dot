import { CONFIG } from '../core/config';
import type { WidgetPosition, WidgetSize } from '../core/types';

export interface ViewportBounds {
  width: number;
  height: number;
}

export interface OriginPoint {
  left: number;
  top: number;
}

export interface LayoutCallbacks {
  /** Dipanggil setiap geometri berubah karena interaksi user / perubahan viewport. */
  onGeometryChange: (position: WidgetPosition | null, size: WidgetSize | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getViewportBounds(): ViewportBounds {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Menjaga widget tetap terlihat penuh di dalam viewport.
 */
export function clampPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: ViewportBounds,
  margin = 0
): WidgetPosition {
  const maxLeft = Math.max(margin, viewport.width - width - margin);
  const maxTop = Math.max(margin, viewport.height - height - margin);

  return {
    x: Math.round(clampNumber(left, margin, maxLeft)),
    y: Math.round(clampNumber(top, margin, maxTop)),
  };
}

/**
 * Membatasi ukuran panel agar tidak melebihi batas config / viewport.
 */
export function clampSize(
  width: number,
  height: number,
  origin: OriginPoint,
  viewport: ViewportBounds,
  margin = 0
): WidgetSize {
  const maxWidth = Math.max(
    CONFIG.PANEL_MIN_WIDTH,
    Math.min(CONFIG.PANEL_MAX_WIDTH, viewport.width - origin.left - margin)
  );
  const maxHeight = Math.max(
    CONFIG.PANEL_MIN_HEIGHT,
    Math.min(CONFIG.PANEL_MAX_HEIGHT, viewport.height - origin.top - margin)
  );

  return {
    width: Math.round(clampNumber(width, CONFIG.PANEL_MIN_WIDTH, maxWidth)),
    height: Math.round(clampNumber(height, CONFIG.PANEL_MIN_HEIGHT, maxHeight)),
  };
}

/**
 * Mengelola posisi host + ukuran panel serta interaksi drag/resize.
 * Semua perubahan langsung diterapkan ke DOM; persistensi ditangani callback.
 */
export class WidgetLayout {
  private host: HTMLElement;
  private callbacks: LayoutCallbacks;
  private panel: HTMLElement | null = null;
  private position: WidgetPosition | null = null;
  private size: WidgetSize | null = null;
  private interacting = false;
  private clickSuppressed = false;
  private activeCleanup: (() => void) | null = null;
  private readonly onViewportResize = () => {
    if (!this.interacting) {
      this.constrainLayout();
    }
  };
  private readonly onWindowBlur = () => {
    if (!this.activeCleanup) return;
    this.activeCleanup();
    this.interacting = false;
    this.callbacks.onInteractionEnd?.();
  };

  constructor(host: HTMLElement, callbacks: LayoutCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    window.addEventListener('resize', this.onViewportResize);
    window.addEventListener('blur', this.onWindowBlur);
  }

  public applyLayout(position: WidgetPosition | null, size: WidgetSize | null): void {
    this.position = position ? { ...position } : null;
    this.size = size ? { ...size } : null;
    this.applyPosition();
    this.applySize();
  }

  /** Panel baru dibuat setiap render, jadi controller perlu referensi terbaru. */
  public setPanel(panel: HTMLElement | null): void {
    this.panel = panel;
    this.applySize();
  }

  public isInteracting(): boolean {
    return this.interacting;
  }

  /**
   * Mengonsumsi flag klik palsu setelah drag (agar chip tidak ikut terbuka).
   */
  public consumeClickSuppression(): boolean {
    if (!this.clickSuppressed) return false;
    this.clickSuppressed = false;
    return true;
  }

  /** Clamp posisi/ukuran terhadap viewport saat mount, render, atau window resize. */
  public constrainLayout(): void {
    if (!this.host.isConnected) return;

    const viewport = getViewportBounds();
    if (viewport.width === 0 || viewport.height === 0) return;

    const rect = this.host.getBoundingClientRect();
    let changed = false;

    if (this.position) {
      const next = clampPosition(
        this.position.x,
        this.position.y,
        rect.width,
        rect.height,
        viewport,
        CONFIG.LAYOUT_MARGIN_PX
      );
      if (next.x !== this.position.x || next.y !== this.position.y) {
        this.position = next;
        this.applyPosition();
        changed = true;
      }
    }

    if (this.size) {
      const origin = {
        left: this.position?.x ?? Math.max(0, rect.left),
        top: this.position?.y ?? Math.max(0, rect.top),
      };
      const next = clampSize(
        this.size.width,
        this.size.height,
        origin,
        viewport,
        CONFIG.LAYOUT_MARGIN_PX
      );
      if (next.width !== this.size.width || next.height !== this.size.height) {
        this.size = next;
        this.applySize();
        changed = true;
      }
    }

    if (changed) {
      this.callbacks.onGeometryChange(this.position, this.size);
    }
  }

  /** Keyboard resize: panah mengubah ukuran panel per 16 px (Shift: 40 px). */
  public nudgeSize(deltaWidth: number, deltaHeight: number): void {
    if (!this.panel) return;

    const rect = this.panel.getBoundingClientRect();

    // Ubah anchor kanan-atas menjadi koordinat kiri-atas agar panel melebar ke kanan.
    if (!this.position) {
      this.position = { x: Math.round(rect.left), y: Math.round(rect.top) };
      this.applyPosition();
    }

    const viewport = getViewportBounds();
    const origin = {
      left: this.position.x,
      top: this.position.y,
    };

    const width = this.size?.width ?? (rect.width || 280);
    const height = this.size?.height ?? (rect.height || 320);

    this.size = clampSize(
      width + deltaWidth,
      height + deltaHeight,
      origin,
      viewport,
      CONFIG.LAYOUT_MARGIN_PX
    );
    this.applySize();
    this.callbacks.onGeometryChange(this.position, this.size);
  }

  public makeDraggable(handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (this.activeCleanup) return;

      const target = event.target as Element | null;
      const button = target && typeof target.closest === 'function'
        ? target.closest('button')
        : null;
      if (button && button !== handle) return;

      const startRect = this.host.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;
      let moved = false;

      capturePointer(handle, pointerId);

      const cleanup = () => {
        releasePointer(handle, pointerId);
        handle.classList.remove('is-dragging');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this.activeCleanup = null;
      };

      const finish = () => {
        cleanup();
        handle.classList.remove('is-dragging');

        if (moved) {
          this.callbacks.onGeometryChange(this.position, this.size);
        }

        this.interacting = false;
        this.callbacks.onInteractionEnd?.();
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!moved) {
          if (Math.hypot(dx, dy) < CONFIG.DRAG_THRESHOLD_PX) return;
          moved = true;
          this.interacting = true;
          this.callbacks.onInteractionStart?.();
          handle.classList.add('is-dragging');
        }

        const viewport = getViewportBounds();
        this.position = clampPosition(
          startRect.left + dx,
          startRect.top + dy,
          startRect.width,
          startRect.height,
          viewport,
          CONFIG.LAYOUT_MARGIN_PX
        );
        this.applyPosition();
      };

      const onPointerUp = () => {
        finish();
        if (moved) {
          this.suppressClick();
        }
      };

      this.interacting = false;
      this.activeCleanup = cleanup;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  public makeResizable(grip: HTMLElement, panel: HTMLElement): void {
    grip.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (this.activeCleanup) return;
      event.preventDefault();
      event.stopPropagation();

      const panelRect = panel.getBoundingClientRect();
      const hostRect = this.host.getBoundingClientRect();
      const startWidth = panelRect.width || CONFIG.PANEL_MIN_WIDTH;
      const startHeight = panelRect.height || CONFIG.PANEL_MIN_HEIGHT;
      const startLeft = hostRect.left;
      const startTop = hostRect.top;
      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;
      let moved = false;

      capturePointer(grip, pointerId);

      const cleanup = () => {
        releasePointer(grip, pointerId);
        panel.classList.remove('is-resizing');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this.activeCleanup = null;
      };

      const finish = () => {
        cleanup();
        panel.classList.remove('is-resizing');

        if (moved) {
          this.callbacks.onGeometryChange(this.position, this.size);
        }

        this.interacting = false;
        this.callbacks.onInteractionEnd?.();
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!moved) {
          if (Math.hypot(dx, dy) < CONFIG.DRAG_THRESHOLD_PX) return;
          moved = true;
          this.interacting = true;
          this.callbacks.onInteractionStart?.();
          panel.classList.add('is-resizing');

          // Ubah anchor kanan-atas menjadi koordinat kiri-atas agar grip mengikuti pointer.
          if (!this.position) {
            this.position = { x: Math.round(startLeft), y: Math.round(startTop) };
            this.applyPosition();
          }
        }

        const viewport = getViewportBounds();
        let originTop = startTop;

        if (this.position) {
          originTop = this.position.y;
        }

        let nextSize = clampSize(
          startWidth + dx,
          startHeight + dy,
          { left: this.position?.x ?? startLeft, top: originTop },
          viewport,
          CONFIG.LAYOUT_MARGIN_PX
        );

        // Jika panel berada dekat bawah viewport, geser host ke atas agar muat.
        if (originTop + nextSize.height + CONFIG.LAYOUT_MARGIN_PX > viewport.height) {
          const shiftedTop = Math.max(
            CONFIG.LAYOUT_MARGIN_PX,
            viewport.height - nextSize.height - CONFIG.LAYOUT_MARGIN_PX
          );
          this.position = clampPosition(
            this.position?.x ?? startLeft,
            shiftedTop,
            nextSize.width,
            nextSize.height,
            viewport,
            CONFIG.LAYOUT_MARGIN_PX
          );
          this.applyPosition();
          originTop = this.position.y;
          nextSize = clampSize(
            nextSize.width,
            nextSize.height,
            { left: this.position.x, top: originTop },
            viewport,
            CONFIG.LAYOUT_MARGIN_PX
          );
        }

        this.size = nextSize;
        this.applySize();
      };

      const onPointerUp = () => {
        finish();
        if (moved) {
          this.suppressClick();
        }
      };

      this.interacting = false;
      this.activeCleanup = cleanup;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onViewportResize);
    window.removeEventListener('blur', this.onWindowBlur);
    this.activeCleanup?.();
    this.activeCleanup = null;
    this.panel = null;
    this.interacting = false;
    this.clickSuppressed = false;
  }

  private suppressClick(): void {
    this.clickSuppressed = true;
    setTimeout(() => {
      this.clickSuppressed = false;
    }, 400);
  }

  private applyPosition(): void {
    if (this.position) {
      this.host.style.setProperty('left', `${this.position.x}px`, 'important');
      this.host.style.setProperty('top', `${this.position.y}px`, 'important');
      this.host.style.setProperty('right', 'auto', 'important');
      this.host.style.setProperty('bottom', 'auto', 'important');
    } else {
      this.host.style.removeProperty('left');
      this.host.style.removeProperty('bottom');
      this.host.style.setProperty('top', `${CONFIG.TOP_OFFSET_PX}px`, 'important');
      this.host.style.setProperty('right', `${CONFIG.RIGHT_OFFSET_PX}px`, 'important');
    }
  }

  private applySize(): void {
    if (!this.panel) return;

    if (this.size) {
      this.panel.style.width = `${this.size.width}px`;
      this.panel.style.height = `${this.size.height}px`;
      this.panel.classList.add('is-sized');
    } else {
      this.panel.style.removeProperty('width');
      this.panel.style.removeProperty('height');
      this.panel.classList.remove('is-sized');
    }
  }
}

function capturePointer(element: HTMLElement, pointerId: number): void {
  if (typeof element.setPointerCapture !== 'function') return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer sudah tidak aktif; abaikan.
  }
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  if (typeof element.releasePointerCapture !== 'function') return;
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Pointer sudah tidak aktif; abaikan.
  }
}
