import { useEffect } from 'react';

let modalLockCount = 0;
let savedBodyStyles = null;

const saveBodyStyles = (body) => ({
  overflow: body.style.overflow,
  position: body.style.position,
  top: body.style.top,
  width: body.style.width,
  paddingRight: body.style.paddingRight
});

const restoreBodyStyles = (body, styles) => {
  body.style.overflow = styles.overflow;
  body.style.position = styles.position;
  body.style.top = styles.top;
  body.style.width = styles.width;
  body.style.paddingRight = styles.paddingRight;
};

export const useModalBodyLock = (isOpen) => {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;

    if (modalLockCount === 0) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      savedBodyStyles = {
        ...saveBodyStyles(body),
        scrollY
      };

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    modalLockCount += 1;

    return () => {
      modalLockCount = Math.max(0, modalLockCount - 1);

      if (modalLockCount === 0 && savedBodyStyles) {
        const { scrollY } = savedBodyStyles;
        restoreBodyStyles(body, savedBodyStyles);
        window.scrollTo(0, scrollY);
        savedBodyStyles = null;
      }
    };
  }, [isOpen]);
};

export default useModalBodyLock;
