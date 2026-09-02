export type Rng = {
  nextInt: (maxExclusive: number) => number;
  shuffle: <T>(items: readonly T[]) => T[];
};

/** Mulberry32. Same seed always yields the same sequence. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextInt = (maxExclusive: number) => {
    if (maxExclusive <= 0) {
      throw new Error(`nextInt expected a positive bound, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };
  return {
    nextInt,
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = nextInt(i + 1);
        const tmp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

export function randomUint32(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  return (Math.floor(Math.random() * 0x100000000) >>> 0);
}
