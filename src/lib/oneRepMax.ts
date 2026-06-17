/** Estimated one-rep max via the Epley formula. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Total volume (load × reps) for a set. */
export function setVolume(weightKg: number, reps: number): number {
  return weightKg * reps;
}
