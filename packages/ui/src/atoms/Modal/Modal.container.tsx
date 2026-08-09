import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { lockDocumentScroll } from '../../utils/documentScrollLock';

import { ModalComponent } from './Modal.component';
import type { ModalProps } from './Modal.types';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
  showCloseButton = true,
  showDivider = true,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    return lockDocumentScroll();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <ModalComponent
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size={size}
      className={className}
      showCloseButton={showCloseButton}
      showDivider={showDivider}
    >
      {children}
    </ModalComponent>,
    document.body,
  );
};

Modal.displayName = 'Modal';
