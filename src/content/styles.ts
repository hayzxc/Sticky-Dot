export const STYLES = `
:host {
  all: initial;
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 2147483647;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #1F2937;
  direction: ltr;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Base Container */
.sd-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* Chip Button (Folded State) */
.sd-chip {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
  color: #1F2937;
  outline: none;
  user-select: none;
}

.sd-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
  background-color: #F9FAFB;
}

.sd-chip:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

.sd-chip svg {
  width: 20px;
  height: 20px;
}

/* Badge count on chip */
.sd-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #10B981;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  min-width: 17px;
  height: 17px;
  line-height: 17px;
  border-radius: 9px;
  text-align: center;
  padding: 0 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

/* Panel (Expanded State) */
.sd-panel {
  width: 280px;
  max-height: 60vh;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 120ms ease, transform 120ms ease;
}

@media (max-width: 480px) {
  .sd-panel {
    width: calc(100vw - 24px);
  }
}

/* Dark mode panel support */
@media (prefers-color-scheme: dark) {
  .sd-panel {
    background: #1E293B;
    border-color: #334155;
    color: #F8FAFC;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
  }
  .sd-chip {
    background: #1E293B;
    border-color: #334155;
    color: #F8FAFC;
  }
  .sd-chip:hover {
    background: #334155;
  }
  .sd-header {
    border-color: #334155 !important;
  }
  .sd-header-title {
    color: #F8FAFC !important;
  }
  .sd-icon-btn {
    color: #94A3B8 !important;
  }
  .sd-icon-btn:hover {
    background: #334155 !important;
    color: #F8FAFC !important;
  }
  .sd-empty-text {
    color: #94A3B8 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sd-chip, .sd-panel, .sd-note-card, .sd-btn-delete {
    transition: none !important;
  }
}

/* Header */
.sd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #F1F5F9;
  background: transparent;
  user-select: none;
}

.sd-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sd-header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
}

.sd-header-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.sd-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Buttons */
.sd-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #4B5563;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  transition: background-color 100ms ease, color 100ms ease;
}

.sd-icon-btn:hover:not(:disabled) {
  background: #F3F4F6;
  color: #111827;
}

.sd-icon-btn:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 1px;
}

.sd-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sd-icon-btn svg {
  width: 16px;
  height: 16px;
}

/* Note List Container */
.sd-notes-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  max-height: calc(60vh - 48px);
}

.sd-notes-list::-webkit-scrollbar {
  width: 5px;
}

.sd-notes-list::-webkit-scrollbar-track {
  background: transparent;
}

.sd-notes-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.4);
  border-radius: 4px;
}

.sd-notes-list::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}

/* Empty State */
.sd-empty-state {
  padding: 28px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sd-empty-icon {
  width: 32px;
  height: 32px;
  color: #9CA3AF;
  opacity: 0.6;
}

.sd-empty-text {
  font-size: 12px;
  color: #6B7280;
  line-height: 1.4;
}

/* Note Card */
.sd-note-card {
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  color: #2B2B2B;
}

/* Textarea */
.sd-textarea {
  width: 100%;
  min-height: 54px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  color: #2B2B2B;
  padding: 0;
  box-sizing: border-box;
}

.sd-textarea::placeholder {
  color: rgba(43, 43, 43, 0.5);
}

.sd-textarea:focus-visible {
  outline: none;
}

/* Note Footer */
.sd-note-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* Color Palette Dots */
.sd-colors {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sd-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  outline: none;
  transition: transform 100ms ease;
  padding: 0;
}

.sd-color-dot:hover {
  transform: scale(1.2);
}

.sd-color-dot:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 1px;
}

.sd-color-dot.active {
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 3px #10B981;
}

/* Right side of footer: Counter + Delete Button */
.sd-footer-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sd-char-counter {
  font-size: 10px;
  color: #6B7280;
  font-weight: 500;
}

.sd-char-counter.warning {
  color: #DC2626;
  font-weight: 700;
}

.sd-btn-delete {
  padding: 2px 6px;
  font-size: 11px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #6B7280;
  cursor: pointer;
  outline: none;
  transition: all 120ms ease;
  line-height: 16px;
  height: 20px;
}

.sd-btn-delete:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1F2937;
}

.sd-btn-delete.confirm {
  background: #EF4444;
  color: #FFFFFF;
  font-weight: 600;
}

.sd-btn-delete.confirm:hover {
  background: #DC2626;
}

.sd-btn-delete:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 1px;
}

/* Toast Notification */
.sd-toast {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  background: #1F2937;
  color: #FFFFFF;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  text-align: center;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity 150ms ease, transform 150ms ease;
  z-index: 10;
}

.sd-toast.show {
  opacity: 1;
  transform: translateY(0);
}
`;
