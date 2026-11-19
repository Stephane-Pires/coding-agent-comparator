/** One labelled case of an evaluation set, as the report needs it. */
export interface Case {
  /** The group it is reported in. */
  readonly kind: string;
  readonly expect: string;
}

interface Measured<C extends Case> {
  readonly case: C;
  readonly got: string;
  readonly reason: string;
  readonly ms: number;
}

const CONCURRENCY = 4;

/**
 * Runs every case through `answer`, a few at a time, and prints the score, the count of the worst kind of mistake,
 * the time per call and every miss. The process exits with 1 when a case missed.
 */
export async function measure<C extends Case>(options: {
  readonly model: string;
  readonly cases: readonly C[];
  /** A line that names a case in the report. */
  readonly title: (labelled: C) => string;
  readonly answer: (labelled: C) => Promise<{ got: string; reason: string }>;
  /** The mistake that matters most, counted apart. */
  readonly worst: { readonly label: string; readonly is: (labelled: C, got: string) => boolean };
}): Promise<void> {
  const { model, cases, title, answer, worst } = options;
  const run = async (labelled: C): Promise<Measured<C>> => {
    const startedAt = performance.now();
    try {
      return { case: labelled, ...(await answer(labelled)), ms: performance.now() - startedAt };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { case: labelled, got: 'error', reason, ms: performance.now() - startedAt };
    }
  };

  const measured: Measured<C>[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const result = await run(next);
        measured.push(result);
        const mark = result.got === next.expect ? 'ok  ' : 'MISS';
        console.log(`${mark} ${next.kind.padEnd(16)} ${title(next).slice(0, 68)}`);
      }
    }),
  );

  const misses = measured.filter((result) => result.got !== result.case.expect);
  const times = measured.map(({ ms }) => ms).toSorted((a, b) => a - b);
  console.log(`\nModel: ${model}`);
  console.log(`Score: ${measured.length - misses.length} of ${measured.length}`);
  console.log(`${worst.label}: ${misses.filter((miss) => worst.is(miss.case, miss.got)).length}`);
  console.log(
    `Time per call: median ${Math.round(times[Math.floor(times.length / 2)] ?? 0)} ms, slowest ${Math.round(times.at(-1) ?? 0)} ms (${CONCURRENCY} at a time)`,
  );
  for (const miss of misses)
    console.log(
      `\nMISS (${miss.case.kind}) expected ${miss.case.expect}, got ${miss.got}\n  case:   ${title(miss.case)}\n  reason: ${miss.reason}`,
    );
  process.exitCode = misses.length === 0 ? 0 : 1;
}
