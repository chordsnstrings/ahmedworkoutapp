import { create } from 'zustand';

interface RestTimerState {
  /** Epoch ms when the current rest ends, or null if idle. */
  endsAt: number | null;
  durationSec: number;
  running: boolean;
  start: (seconds: number) => void;
  addTime: (seconds: number) => void;
  stop: () => void;
  remaining: () => number;
}

let tickHandle: ReturnType<typeof setInterval> | null = null;

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  durationSec: 0,
  running: false,

  start: (seconds) => {
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, durationSec: seconds, running: true });
    if (tickHandle) clearInterval(tickHandle);
    // Re-render subscribers each second; fire a notification at zero.
    tickHandle = setInterval(() => {
      const { endsAt: e } = get();
      if (e == null) return;
      if (Date.now() >= e) {
        notifyDone();
        get().stop();
      } else {
        // Touch state to trigger re-render of consumers reading remaining().
        set((s) => ({ ...s }));
      }
    }, 250);
  },

  addTime: (seconds) => {
    const { endsAt } = get();
    const base = endsAt && endsAt > Date.now() ? endsAt : Date.now();
    set({ endsAt: base + seconds * 1000, running: true });
  },

  stop: () => {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
    set({ endsAt: null, running: false, durationSec: 0 });
  },

  remaining: () => {
    const { endsAt } = get();
    if (endsAt == null) return 0;
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  },
}));

function notifyDone() {
  // Haptic + optional notification when rest is over.
  if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120]);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Rest complete 💪', { body: 'Time for your next set.' });
  }
}
