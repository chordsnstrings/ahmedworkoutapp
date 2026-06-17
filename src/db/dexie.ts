import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  Settings,
  ProgramDay,
  Workout,
  SetLog,
  BodyStat,
  ProgressPhoto,
  PersonalRecord,
} from './types';

export class ApexDB extends Dexie {
  exercises!: Table<Exercise, string>;
  settings!: Table<Settings, string>;
  programDays!: Table<ProgramDay, string>;
  workouts!: Table<Workout, string>;
  setLogs!: Table<SetLog, string>;
  bodyStats!: Table<BodyStat, string>;
  photos!: Table<ProgressPhoto, string>;
  personalRecords!: Table<PersonalRecord, string>;

  constructor() {
    super('apex-transformation');
    this.version(1).stores({
      exercises: 'id, muscleGroup, equipment, isCustom',
      settings: 'id',
      programDays: 'id, weekIndex, dayIndex',
      workouts: 'id, date, status, programDayId',
      setLogs: 'id, workoutId, exerciseId, createdAt',
      bodyStats: 'id, date',
      photos: 'id, date, label',
      personalRecords: 'exerciseId',
    });
  }
}

export const db = new ApexDB();
