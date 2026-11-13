export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

/** Run a helper that throws plain errors, re-throwing them as illegal actions. */
export function asIllegal<T>(run: () => T, fallback: string): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof IllegalActionError) throw error;
    throw new IllegalActionError(error instanceof Error ? error.message : fallback);
  }
}
