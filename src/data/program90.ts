import type { ProgramDay, ExerciseSlot, SplitType } from '@/db/types';

/**
 * A periodized 90-day Push/Pull/Legs program (13 weeks ≈ 91 days).
 * Week structure: Push · Pull · Legs · Push · Pull · Legs · Rest.
 * Rep ranges tighten and intensity cues escalate over the mesocycles.
 */

const slot = (exerciseId: string, sets: number, repRange: string): ExerciseSlot => ({
  exerciseId,
  sets,
  repRange,
});

// Two variations per movement pattern keep the week from feeling repetitive.
const TEMPLATES: Record<Exclude<SplitType, 'Rest'>, { title: string; slots: ExerciseSlot[] }[]> = {
  Push: [
    {
      title: 'Push A — Chest Focus',
      slots: [
        slot('bench-press', 4, '6-10'),
        slot('incline-db', 3, '8-12'),
        slot('db-shoulder-press', 3, '8-12'),
        slot('cable-fly', 3, '12-15'),
        slot('lateral-raise', 3, '12-20'),
        slot('tricep-pushdown', 3, '10-15'),
      ],
    },
    {
      title: 'Push B — Shoulder Focus',
      slots: [
        slot('ohp', 4, '6-10'),
        slot('incline-bench', 3, '8-12'),
        slot('pec-deck', 3, '12-15'),
        slot('cable-lateral', 4, '12-20'),
        slot('overhead-ext', 3, '10-15'),
        slot('dips-tricep', 3, '8-12'),
      ],
    },
  ],
  Pull: [
    {
      title: 'Pull A — Width',
      slots: [
        slot('pullup', 4, '6-10'),
        slot('bent-row', 4, '6-10'),
        slot('lat-pulldown', 3, '10-12'),
        slot('face-pull', 3, '15-20'),
        slot('barbell-curl', 3, '8-12'),
        slot('hammer-curl', 3, '10-15'),
      ],
    },
    {
      title: 'Pull B — Thickness',
      slots: [
        slot('deadlift', 3, '4-6'),
        slot('seated-row', 4, '8-12'),
        slot('db-row', 3, '8-12'),
        slot('straight-arm-pd', 3, '12-15'),
        slot('preacher-curl', 3, '10-12'),
        slot('cable-curl', 3, '12-15'),
      ],
    },
  ],
  Legs: [
    {
      title: 'Legs A — Quad Focus',
      slots: [
        slot('back-squat', 4, '6-10'),
        slot('leg-press', 3, '10-15'),
        slot('rdl', 3, '8-12'),
        slot('leg-ext', 3, '12-15'),
        slot('calf-raise', 4, '12-20'),
        slot('hanging-leg-raise', 3, '10-15'),
      ],
    },
    {
      title: 'Legs B — Posterior Chain',
      slots: [
        slot('rdl', 4, '6-10'),
        slot('bulgarian-split', 3, '8-12'),
        slot('hip-thrust', 3, '10-15'),
        slot('leg-curl', 3, '12-15'),
        slot('seated-calf', 4, '15-20'),
        slot('cable-crunch', 3, '12-15'),
      ],
    },
  ],
  Upper: [{ title: 'Upper', slots: [] }],
  Lower: [{ title: 'Lower', slots: [] }],
  'Full Body': [{ title: 'Full Body', slots: [] }],
};

// Weekly intensity cue, cycling through accumulation → intensification → deload.
function phaseNote(weekIndex: number): string {
  const inMeso = weekIndex % 4;
  if (inMeso === 3) return 'Deload week — drop to ~60% intensity, focus on form & recovery.';
  if (inMeso === 0) return 'Accumulation — add a rep to each set vs. last cycle.';
  if (inMeso === 1) return 'Progress — aim to add weight while staying in the rep range.';
  return 'Intensification — push the last set close to failure (RPE 9).';
}

const WEEK_PATTERN: SplitType[] = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'];

export function buildProgram90(): ProgramDay[] {
  const days: ProgramDay[] = [];
  const TOTAL_WEEKS = 13;

  for (let week = 0; week < TOTAL_WEEKS; week++) {
    const note = phaseNote(week);
    // Track A/B alternation per split across the whole program.
    const variantCounter: Record<string, number> = { Push: 0, Pull: 0, Legs: 0 };

    WEEK_PATTERN.forEach((split, dayIndex) => {
      if (split === 'Rest') {
        days.push({
          id: `${week}-${dayIndex}`,
          weekIndex: week,
          dayIndex,
          splitType: 'Rest',
          title: 'Rest & Recover',
          focusNote: 'Active recovery: walk, stretch, hydrate. Growth happens now.',
          exerciseSlots: [],
        });
        return;
      }

      const variants = TEMPLATES[split as Exclude<SplitType, 'Rest'>];
      // Global A/B alternation, also offset by week so the journey stays fresh.
      const idx = (variantCounter[split] + week) % variants.length;
      variantCounter[split] += 1;
      const tpl = variants[idx];

      days.push({
        id: `${week}-${dayIndex}`,
        weekIndex: week,
        dayIndex,
        splitType: split,
        title: tpl.title,
        focusNote: note,
        exerciseSlots: tpl.slots,
      });
    });
  }

  return days;
}

export const PROGRAM_TOTAL_DAYS = 90;
