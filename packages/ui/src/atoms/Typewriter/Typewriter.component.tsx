import * as S from './Typewriter.style';
import type { TypewriterComponentProps } from './Typewriter.types';

export const TypewriterComponent = ({
  text,
  className,
}: TypewriterComponentProps) => {
  return (
    <S.Container className={className}>
      {text}
      <S.Cursor />
    </S.Container>
  );
};

TypewriterComponent.displayName = 'TypewriterComponent';
