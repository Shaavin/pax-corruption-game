"use client";

const KEY = "pax-turn-alerts";

/** Whether this browser wants a chime/notification on its turn (opt-in). */
export function readTurnAlerts(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTurnAlerts(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered.
  }
}

let audio: AudioContext | null = null;

/**
 * A soft two-note chime. `unlock` is for the click that turns alerts on: browsers only
 * allow sound after a user gesture, so that click creates the audio context (quietly).
 */
export function playTurnChime(unlock = false): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    if (unlock) return;
    const now = audio.currentTime;
    for (const [index, frequency] of [659.25, 987.77].entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    }
  } catch {
    // No audio: the tab title still changes.
  }
}
