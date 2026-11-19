/** Tells the time, so that a run can say how long it took. */
export interface Clock {
  /** Milliseconds from any fixed point: only the difference between two readings means something. */
  now(): number;
}
