import { eq } from "drizzle-orm";
import { jobRuns } from "@/db/schema";
import type { DbLike } from "../store/common";

export interface JobOutcome {
  status: "succeeded" | "skipped";
  itemsWritten: number;
  details?: Record<string, unknown>;
}

export interface JobReport extends Omit<JobOutcome, "status"> {
  job: string;
  status: JobOutcome["status"] | "failed";
  durationMs: number;
  error?: string;
}

/**
 * Führt einen Job aus und protokolliert Dauer, Ergebnis und Fehler in
 * `job_runs`. Ein Fehler wird protokolliert und zurückgegeben, nicht
 * weitergeworfen – ein Anbieterausfall reißt so nicht die ganze Pipeline.
 */
export async function runJob(
  db: DbLike,
  job: string,
  fn: () => Promise<JobOutcome>,
): Promise<JobReport> {
  const started = Date.now();
  const [run] = await db
    .insert(jobRuns)
    .values({ job, status: "running" })
    .returning({ id: jobRuns.id });
  try {
    const outcome = await fn();
    const durationMs = Date.now() - started;
    await db
      .update(jobRuns)
      .set({
        status: outcome.status,
        finishedAt: new Date(),
        durationMs,
        itemsWritten: outcome.itemsWritten,
        details: outcome.details ?? null,
      })
      .where(eq(jobRuns.id, run!.id));
    return { job, durationMs, ...outcome };
  } catch (err) {
    const durationMs = Date.now() - started;
    const error = err instanceof Error ? err.message : String(err);
    await db
      .update(jobRuns)
      .set({ status: "failed", finishedAt: new Date(), durationMs, error })
      .where(eq(jobRuns.id, run!.id));
    return { job, durationMs, status: "failed", itemsWritten: 0, error };
  }
}
