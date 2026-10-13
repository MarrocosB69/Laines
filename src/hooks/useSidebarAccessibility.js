import { useEffect, useId, useRef } from 'react';
import { useModalFocusTrap } from './useModalFocusTrap';

export const useSidebarAccessibility = (isMobile, isOpen) => {
  const sidebarId = useId();
  const sidebarRef = useRef(null);
  const triggerRef = useRef(null);

  useModalFocusTrap(isMobile && isOpen, sidebarRef);

  useEffect(() => {
    if (!isMobile || !isOpen) return undefined;

    const trigger = triggerRef.current;
    const main = sidebarRef.current?.closest('.admin-container')?.querySelector(':scope > main');
    const wasInert = main?.inert;
    if (main) main.inert = true;

    return () => {
      if (main) main.inert = wasInert;
      // The trigger stays mounted while the drawer is open. Wait until its
      // hidden state has been removed before restoring keyboard focus.
      requestAnimationFrame(() => {
        if (trigger?.isConnected && !trigger.hidden) {
          trigger.focus({ preventScroll: true });
        }
      });
    };
  }, [isMobile, isOpen]);

  return { sidebarId, sidebarRef, triggerRef };
};
