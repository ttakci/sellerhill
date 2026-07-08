import type React from 'react';

import * as S from './MeshBackground.style';
import type { MeshBackgroundComponentProps } from './MeshBackground.types';

export const MeshBackgroundComponent: React.FC<MeshBackgroundComponentProps> = ({ animate, particles }) => {
  return (
    <S.Container>
      <S.Mesh $animate={animate} />
      {particles.map((p) => (
        <S.Particle
          key={p.id}
          size={p.size}
          tx={p.tx}
          ty={p.ty}
          tr={p.tr}
          top={p.top}
          left={p.left}
          delay={p.delay}
          $animate={animate}
        />
      ))}
      <S.Overlay />
    </S.Container>
  );
};

MeshBackgroundComponent.displayName = 'MeshBackgroundComponent';
