// ---- Domain types (NoSQL documents stored in IndexedDB via Dexie) ----

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Legs'
  | 'Arms'
  | 'Core'
  | 'Cardio';

export type Equipment =
  | 'Barbell'
  | 'Dumbbell'
  | 'Machine'
  | 'Cable'
  | 'Bodyweight'
  | 'Kettlebell'
  | 'Other';

export type SplitType = 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body' | 'Rest';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  /** Primary movement category, e.g. "Compound" | "Isolation" */
  category: 'Compound' | 'Isolation' | 'Cardio';
  instructions?: string;
  /** Distinguishes seeded library entries from user-created ones. */
  isCustom: boolean;
}

export type Units = 'kg' | 'lbs';

export interface Settings {
  id: 'app'; // singleton row
  units: Units;
  defaultRestSeconds: number;
  /** ISO date (yyyy-MM-dd) the 90-day journey began. */
  programStartDate: string;
  goalText: string;
  name: string;
  /** Whether onboarding has been completed. */
  onboarded: boolean;
  /** Schema/seed version so we can re-seed on upgrades. */
  seedVersion: number;
}

export interface ExerciseSlot {
  exerciseId: string;
  sets: number;
  repRange: string; // e.g. "8-12"
}

export interface ProgramDay {
  id: string; // `${weekIndex}-${dayIndex}`
  weekIndex: number; // 0-based week within the 90 days
  dayIndex: number; // 0-based day within the week (0-6)
  splitType: SplitType;
  title: string;
  focusNote: string;
  exerciseSlots: ExerciseSlot[];
}

export type WorkoutStatus = 'active' | 'completed';

export interface Workout {
  id: string;
  date: string; // yyyy-MM-dd
  programDayId?: string;
  title: string;
  status: WorkoutStatus;
  startedAt: number; // epoch ms
  completedAt?: number;
  notes?: string;
}

export interface SetLog {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  completed: boolean;
  isPR: boolean;
  createdAt: number;
}

export interface Measurements {
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  shoulders?: number;
}

export interface BodyStat {
  id: string;
  date: string; // yyyy-MM-dd
  weightKg?: number;
  bodyFat?: number;
  measurements?: Measurements;
  createdAt: number;
}

export interface ProgressPhoto {
  id: string;
  date: string; // yyyy-MM-dd
  blob: Blob;
  label: string; // e.g. "Front", "Side", "Back"
  createdAt: number;
}

export interface PersonalRecord {
  exerciseId: string; // primary key
  bestEstimated1RM: number; // kg
  bestWeightKg: number;
  bestReps: number;
  achievedAt: number;
}
