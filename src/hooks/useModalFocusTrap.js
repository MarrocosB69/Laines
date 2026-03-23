import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const isVisible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
};

const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((node) => node instanceof HTMLElement)
    .filter((node) => node.getAttribute('aria-hidden') !== 'true')
    .filter((node) => isVisible(node));
};

export const useModalFocusTrap = (isOpen, containerRef) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef?.current;
    if (!container) return undefined;

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusable = getFocusableElements(container);
    const initialFocus = container.querySelector('[data-modal-initial-focus]');
    const initialTarget = (
      initialFocus instanceof HTMLElement
        ? initialFocus
        : focusable[0] || container
    );
    if (initialTarget instanceof HTMLElement) {
      initialTarget.focus({ preventScroll: true });
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;

      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      if (!container.contains(activeElement)) return;

      const loopTargets = getFocusableElements(container);
      if (loopTargets.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = loopTargets[0];
      const last = loopTargets[loopTargets.length - 1];
      if (event.shiftKey) {
        if (activeElement === first || activeElement === container) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef]);
};

export default useModalFocusTrap;
