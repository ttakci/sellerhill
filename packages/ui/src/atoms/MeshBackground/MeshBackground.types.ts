export interface MeshBackgroundProps {
  animate?: boolean;
}

export interface MeshBackgroundComponentProps {
  animate: boolean;
  particles: Array<{
    id: number;
    size: number;
    tx: number;
    ty: number;
    tr: number;
    delay: number;
    top: number;
    left: number;
  }>;
}
