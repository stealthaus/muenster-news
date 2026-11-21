import { h } from './dom';

export const TOAST_MS = 5000;

/** One message at a time at the bottom, optionally with "Rückgängig". */
export class Toaster {
  private el: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: HTMLElement) {
    this.el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
    host.append(this.el);
  }

  show(message: string, undo?: () => void): void {
    this.clear();
    this.el.replaceChildren(h('span', { class: 'toast-text' }, message));
    if (undo) {
      const btn = h('button', { class: 'toast-undo', type: 'button' }, 'Rückgängig');
      btn.addEventListener('click', () => {
        this.hide();
        undo();
      });
      this.el.append(btn);
    }
    this.el.hidden = false;
    this.timer = setTimeout(() => this.hide(), TOAST_MS);
  }

  hide(): void {
    this.clear();
    this.el.hidden = true;
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
