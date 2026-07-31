/**
 * Applies a per-record operation across a selection, reporting progress and
 * partial failure.
 *
 * ## This is not a bulk endpoint
 *
 * The API has no batch routes — there is `DELETE /trips/{id}/cancel`, not
 * `POST /trips/cancel`. So "cancel 12 trips" is genuinely twelve requests, and
 * this helper exists to be honest about the consequences of that rather than
 * hide them:
 *
 *   - **Partial success is the normal case, not an edge case.** Nine can
 *     succeed and three fail, and the caller has to be able to say so. An
 *     all-or-nothing "Done!" toast would be a lie the operator acts on.
 *   - **It is not atomic.** There is no rollback. A caller must not describe
 *     the operation as one that either fully happens or doesn't.
 *   - **Concurrency is capped.** Firing 50 parallel requests at a small
 *     backend is how you turn a bulk action into an outage; four at a time
 *     keeps it responsive without stampeding.
 *
 * If batch endpoints are added later, this is the seam to replace — the calling
 * components only ever see `{ succeeded, failed }`.
 *
 * @param {Array} items            records to act on
 * @param {(item) => Promise} run  the per-record operation
 * @param {{ onProgress?: (done, total) => void, concurrency?: number }} options
 * @returns {Promise<{ succeeded: Array, failed: Array<{ item, error }> }>}
 */
export async function runBulk(items, run, { onProgress, concurrency = 4 } = {}) {
  const queue = [...items];
  const succeeded = [];
  const failed = [];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        await run(item);
        succeeded.push(item);
      } catch (error) {
        // Collected rather than thrown: one failure must not abandon the
        // remaining records, or a mid-batch network blip leaves the operator
        // with no idea which half went through.
        failed.push({ item, error });
      } finally {
        done += 1;
        onProgress?.(done, items.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return { succeeded, failed };
}

/**
 * Turns a bulk result into the toast an operator can act on.
 * Deliberately never says "all done" unless nothing failed.
 */
export function describeBulkResult({ succeeded, failed }, { verb, noun, nounPlural }) {
  const label = (n) => `${n} ${n === 1 ? noun : nounPlural}`;

  if (failed.length === 0) {
    return { type: "success", title: `${label(succeeded.length)} ${verb}`, message: null };
  }
  if (succeeded.length === 0) {
    return {
      type: "error",
      title: `Couldn't ${verb.replace(/ed$/, "")} ${label(failed.length)}`,
      message: "Nothing was changed. Please try again.",
    };
  }
  return {
    type: "warning",
    title: `${label(succeeded.length)} ${verb}`,
    message: `${failed.length} could not be updated and ${failed.length === 1 ? "was" : "were"} left unchanged.`,
  };
}
