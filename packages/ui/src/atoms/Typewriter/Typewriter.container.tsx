import { useEffect, useState } from 'react';

import { TypewriterComponent } from './Typewriter.component';
import type { TypewriterProps } from './Typewriter.types';

export const Typewriter = ({
  phrases,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseTime = 2000,
  className,
}: TypewriterProps) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (subIndex === phrases[index].length + 1 && !isDeleting) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseTime);
      return () => clearTimeout(timeout);
    }

    if (subIndex === 0 && isDeleting) {
      const timeout = setTimeout(() => {
        setIndex((prev) => (prev + 1) % phrases.length);
        setIsDeleting(false);
      }, typingSpeed);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
      },
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting, phrases, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <TypewriterComponent
      text={phrases[index].substring(0, subIndex)}
      className={className}
    />
  );
};

Typewriter.displayName = 'Typewriter';
