export class OcrRuntimeError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`The OCR engine failed while reading this certification. Please retry the upload. This is a processing error, not a scan-quality determination. (${detail.slice(0, 500)})`);
    this.name = 'OcrRuntimeError';
  }
}

/** Serialize each worker and discard failed runtimes before another page uses them. */
export function createOcrWorkerPool<Worker>(create: () => Promise<Worker>, dispose: (worker: Worker) => Promise<unknown>) {
  const slots: Array<{worker: Promise<Worker> | null; tail: Promise<void>}> = [];
  let next = 0;
  return {
    run<Result>(count: number, recognize: (worker: Worker) => Promise<Result>): Promise<Result> {
      if (!Number.isInteger(count) || count < 1 || count > 3) throw new Error('Invalid OCR worker count');
      while (slots.length < count) slots.push({worker: null, tail: Promise.resolve()});
      const slot = slots[next++ % count]!;
      const result = slot.tail.then(async () => {
        try {
          const worker = await (slot.worker ??= create());
          return await recognize(worker);
        } catch (error) {
          const failed = slot.worker;
          slot.worker = null;
          if (failed) await failed.then(dispose).catch(() => undefined);
          throw new OcrRuntimeError(error);
        }
      });
      slot.tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
