const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Given a campaign's ordered steps and the index of the last step already
 * executed (0 = none yet), returns the next step to run, or `null` if the
 * sequence is complete. Pure — no I/O, no dates — so it's trivial to test.
 */
export function resolveNextStep(steps, currentStepIndex) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  return sorted[currentStepIndex] ?? null;
}

/** `fromDate` (Date or ISO string) + `step.delay_days`, as an ISO timestamp. */
export function computeDueAt(step, fromDate) {
  const base = typeof fromDate === "string" ? new Date(fromDate) : fromDate;
  return new Date(base.getTime() + step.delay_days * MS_PER_DAY).toISOString();
}
