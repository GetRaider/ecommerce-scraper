export async function mapWithConcurrency<Input, Result>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }

  const results = new Array<Result>(values.length);
  const pendingValues = values.entries();
  let hasFailed = false;

  async function work(): Promise<void> {
    for (const [currentIndex, value] of pendingValues) {
      if (hasFailed) return;

      try {
        results[currentIndex] = await mapper(value, currentIndex);
      } catch (error) {
        hasFailed = true;
        throw error;
      }
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => work()));
  return results;
}
