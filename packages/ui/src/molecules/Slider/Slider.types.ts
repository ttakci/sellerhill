export interface SliderProps {
  /** Cards rendered inside the horizontal scroll track */
  children: React.ReactNode;
  /** How many cards are visible at once on desktop (affects card width).
   *  On mobile, always shows 1 card at ~80% viewport width. Default: 3 */
  itemsToShow?: number;
  /** Aria label for the slider region */
  ariaLabel?: string;
}

export interface SliderComponentProps extends SliderProps {
  /** Scroll the track one card-width to the left */
  onPrev: () => void;
  /** Scroll the track one card-width to the right */
  onNext: () => void;
  /** Whether the left arrow should be disabled (at scroll start) */
  canScrollLeft: boolean;
  /** Whether the right arrow should be disabled (at scroll end) */
  canScrollRight: boolean;
  /** Ref to the scroll container element */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}
