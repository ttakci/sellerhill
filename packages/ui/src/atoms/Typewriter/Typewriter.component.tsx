import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';

interface TypewriterProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseTime?: number;
  className?: string;
}

const Cursor = styled.span`
  display: inline-block;
  width: 0.125rem; /* 2px */
  height: 1em;
  background-color: currentColor;
  margin-left: 0.125rem; /* 2px */
  vertical-align: middle;
  animation: blink 1s infinite step-end;

  @keyframes blink {
    from,
    to {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
`;

const Container = styled.div`
  display: flex;
  align-items: center;
`;

export const Typewriter: React.FC<TypewriterProps> = ({
  phrases,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseTime = 2000,
  className,
}) => {
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
    <Container className={className}>
      {phrases[index].substring(0, subIndex)}
      <Cursor />
    </Container>
  );
};
