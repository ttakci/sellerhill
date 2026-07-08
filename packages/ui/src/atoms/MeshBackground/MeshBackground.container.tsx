import { useMemo } from 'react';

import { MeshBackgroundComponent } from './MeshBackground.component';
import type { MeshBackgroundProps } from './MeshBackground.types';

const particlesCount = 15;
const generateParticles = () =>
  Array.from({ length: particlesCount }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    tx: (Math.random() - 0.5) * 400,
    ty: (Math.random() - 0.5) * 400,
    tr: Math.random() * 360,
    delay: Math.random() * 15,
    top: Math.random() * 100,
    left: Math.random() * 100,
  }));

export const MeshBackground: React.FC<MeshBackgroundProps> = ({ animate = true }) => {
  const particles = useMemo(() => generateParticles(), []);

  return <MeshBackgroundComponent animate={animate} particles={particles} />;
};

MeshBackground.displayName = 'MeshBackground';
