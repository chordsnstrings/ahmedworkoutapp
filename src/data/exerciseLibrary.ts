import type { Exercise } from '@/db/types';

/**
 * Pre-populated library of common gym exercises. Ships with the app and is
 * seeded into IndexedDB on first launch — no server / database required.
 */
type SeedExercise = Omit<Exercise, 'isCustom'>;

const seed: SeedExercise[] = [
  // ---- Chest ----
  { id: 'bench-press', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', category: 'Compound', instructions: 'Lower the bar to mid-chest, drive up while keeping shoulder blades retracted.' },
  { id: 'incline-bench', name: 'Incline Barbell Press', muscleGroup: 'Chest', equipment: 'Barbell', category: 'Compound', instructions: 'Bench set to 30°. Press for upper-chest emphasis.' },
  { id: 'db-bench', name: 'Dumbbell Bench Press', muscleGroup: 'Chest', equipment: 'Dumbbell', category: 'Compound', instructions: 'Greater range of motion than barbell; control the descent.' },
  { id: 'incline-db', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'chest-fly', name: 'Dumbbell Chest Fly', muscleGroup: 'Chest', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'cable-fly', name: 'Cable Crossover', muscleGroup: 'Chest', equipment: 'Cable', category: 'Isolation' },
  { id: 'pec-deck', name: 'Pec Deck Machine', muscleGroup: 'Chest', equipment: 'Machine', category: 'Isolation' },
  { id: 'pushup', name: 'Push-Up', muscleGroup: 'Chest', equipment: 'Bodyweight', category: 'Compound' },
  { id: 'dips-chest', name: 'Chest Dips', muscleGroup: 'Chest', equipment: 'Bodyweight', category: 'Compound', instructions: 'Lean forward to bias the chest.' },

  // ---- Back ----
  { id: 'deadlift', name: 'Barbell Deadlift', muscleGroup: 'Back', equipment: 'Barbell', category: 'Compound', instructions: 'Keep a neutral spine, drive through the floor, lock out the hips.' },
  { id: 'pullup', name: 'Pull-Up', muscleGroup: 'Back', equipment: 'Bodyweight', category: 'Compound' },
  { id: 'chinup', name: 'Chin-Up', muscleGroup: 'Back', equipment: 'Bodyweight', category: 'Compound' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable', category: 'Compound' },
  { id: 'bent-row', name: 'Barbell Bent-Over Row', muscleGroup: 'Back', equipment: 'Barbell', category: 'Compound' },
  { id: 'db-row', name: 'One-Arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'seated-row', name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable', category: 'Compound' },
  { id: 't-bar-row', name: 'T-Bar Row', muscleGroup: 'Back', equipment: 'Barbell', category: 'Compound' },
  { id: 'face-pull', name: 'Face Pull', muscleGroup: 'Back', equipment: 'Cable', category: 'Isolation', instructions: 'Great for rear delts and shoulder health.' },
  { id: 'straight-arm-pd', name: 'Straight-Arm Pulldown', muscleGroup: 'Back', equipment: 'Cable', category: 'Isolation' },
  { id: 'back-ext', name: 'Back Extension', muscleGroup: 'Back', equipment: 'Bodyweight', category: 'Isolation' },

  // ---- Shoulders ----
  { id: 'ohp', name: 'Overhead Barbell Press', muscleGroup: 'Shoulders', equipment: 'Barbell', category: 'Compound', instructions: 'Brace the core, press overhead without leaning back excessively.' },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'arnold-press', name: 'Arnold Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Isolation', instructions: 'Lead with the elbows, no swinging.' },
  { id: 'cable-lateral', name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Cable', category: 'Isolation' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'front-raise', name: 'Front Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'upright-row', name: 'Upright Row', muscleGroup: 'Shoulders', equipment: 'Barbell', category: 'Compound' },
  { id: 'shrug', name: 'Dumbbell Shrug', muscleGroup: 'Shoulders', equipment: 'Dumbbell', category: 'Isolation' },

  // ---- Legs ----
  { id: 'back-squat', name: 'Barbell Back Squat', muscleGroup: 'Legs', equipment: 'Barbell', category: 'Compound', instructions: 'Hit depth with knees tracking over toes, drive up.' },
  { id: 'front-squat', name: 'Front Squat', muscleGroup: 'Legs', equipment: 'Barbell', category: 'Compound' },
  { id: 'leg-press', name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine', category: 'Compound' },
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell', category: 'Compound', instructions: 'Hinge at the hips, feel the hamstring stretch.' },
  { id: 'lunge', name: 'Walking Lunge', muscleGroup: 'Legs', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'bulgarian-split', name: 'Bulgarian Split Squat', muscleGroup: 'Legs', equipment: 'Dumbbell', category: 'Compound' },
  { id: 'leg-ext', name: 'Leg Extension', muscleGroup: 'Legs', equipment: 'Machine', category: 'Isolation' },
  { id: 'leg-curl', name: 'Lying Leg Curl', muscleGroup: 'Legs', equipment: 'Machine', category: 'Isolation' },
  { id: 'hip-thrust', name: 'Barbell Hip Thrust', muscleGroup: 'Legs', equipment: 'Barbell', category: 'Compound' },
  { id: 'calf-raise', name: 'Standing Calf Raise', muscleGroup: 'Legs', equipment: 'Machine', category: 'Isolation' },
  { id: 'seated-calf', name: 'Seated Calf Raise', muscleGroup: 'Legs', equipment: 'Machine', category: 'Isolation' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscleGroup: 'Legs', equipment: 'Dumbbell', category: 'Compound' },

  // ---- Arms ----
  { id: 'barbell-curl', name: 'Barbell Curl', muscleGroup: 'Arms', equipment: 'Barbell', category: 'Isolation' },
  { id: 'db-curl', name: 'Dumbbell Curl', muscleGroup: 'Arms', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscleGroup: 'Arms', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscleGroup: 'Arms', equipment: 'Machine', category: 'Isolation' },
  { id: 'cable-curl', name: 'Cable Curl', muscleGroup: 'Arms', equipment: 'Cable', category: 'Isolation' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscleGroup: 'Arms', equipment: 'Cable', category: 'Isolation' },
  { id: 'overhead-ext', name: 'Overhead Tricep Extension', muscleGroup: 'Arms', equipment: 'Dumbbell', category: 'Isolation' },
  { id: 'skullcrusher', name: 'Skullcrusher', muscleGroup: 'Arms', equipment: 'Barbell', category: 'Isolation' },
  { id: 'dips-tricep', name: 'Tricep Dips', muscleGroup: 'Arms', equipment: 'Bodyweight', category: 'Compound' },
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', muscleGroup: 'Arms', equipment: 'Barbell', category: 'Compound' },
  { id: 'concentration-curl', name: 'Concentration Curl', muscleGroup: 'Arms', equipment: 'Dumbbell', category: 'Isolation' },

  // ---- Core ----
  { id: 'plank', name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight', category: 'Isolation', instructions: 'Hold a straight line from head to heels.' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight', category: 'Isolation' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscleGroup: 'Core', equipment: 'Cable', category: 'Isolation' },
  { id: 'russian-twist', name: 'Russian Twist', muscleGroup: 'Core', equipment: 'Bodyweight', category: 'Isolation' },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', muscleGroup: 'Core', equipment: 'Other', category: 'Isolation' },
  { id: 'leg-raise', name: 'Lying Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight', category: 'Isolation' },
  { id: 'mountain-climber', name: 'Mountain Climbers', muscleGroup: 'Core', equipment: 'Bodyweight', category: 'Cardio' },

  // ---- Cardio ----
  { id: 'treadmill', name: 'Treadmill Run', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'incline-walk', name: 'Incline Treadmill Walk', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'cycling', name: 'Stationary Bike', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'rowing', name: 'Rowing Machine', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'elliptical', name: 'Elliptical', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'stairmaster', name: 'StairMaster', muscleGroup: 'Cardio', equipment: 'Machine', category: 'Cardio' },
  { id: 'jump-rope', name: 'Jump Rope', muscleGroup: 'Cardio', equipment: 'Other', category: 'Cardio' },
  { id: 'burpees', name: 'Burpees', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'Cardio' },
];

export const EXERCISE_LIBRARY: Exercise[] = seed.map((e) => ({ ...e, isCustom: false }));

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_LIBRARY.map((e) => [e.id, e]),
);
