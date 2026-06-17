import type { Units } from '@/db/types';

const LBS_PER_KG = 2.2046226218;

export function kgToDisplay(kg: number, units: Units): number {
  const v = units === 'kg' ? kg : kg * LBS_PER_KG;
  return Math.round(v * 100) / 100;
}

export function displayToKg(value: number, units: Units): number {
  return units === 'kg' ? value : value / LBS_PER_KG;
}

export function formatWeight(kg: number, units: Units, opts: { withUnit?: boolean } = {}): string {
  const v = kgToDisplay(kg, units);
  const str = Number.isInteger(v) ? v.toString() : v.toFixed(1);
  return opts.withUnit === false ? str : `${str} ${units}`;
}

/** Smallest sensible increment in the active unit (2.5 kg / 5 lbs). */
export function weightStepKg(units: Units): number {
  return units === 'kg' ? 2.5 : displayToKg(5, units);
}
