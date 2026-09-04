export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startCoverBackfillScheduler } = await import("@/lib/cover-scheduler");
  startCoverBackfillScheduler();
}
