import "@tanstack/react-start/server-only";

let tail: Promise<void> = Promise.resolve();

export function enqueueImageJob<T>(job: () => Promise<T>): Promise<T> {
  const started = tail.then(job);
  tail = started.then(
    () => undefined,
    () => undefined,
  );
  return started;
}
