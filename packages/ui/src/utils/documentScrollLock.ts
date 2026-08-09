let lockCount = 0;
let previousOverflow = '';

export const lockDocumentScroll = (): (() => void) => {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  lockCount += 1;
  let isReleased = false;

  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = '';
    }
  };
};
