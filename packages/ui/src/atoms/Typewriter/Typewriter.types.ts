export interface TypewriterProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseTime?: number;
  className?: string;
}

export interface TypewriterComponentProps {
  text: string;
  className?: string;
}
