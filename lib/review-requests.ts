/**
 * Timing rules for the automatic review-request job (app/api/cron/review-requests).
 *
 * A request goes out once work has been finished for at least REVIEW_REQUEST_DELAY_DAYS, and only if it
 * finished no more than REVIEW_REQUEST_MAX_AGE_DAYS ago. The upper bound matters: when a store switches the
 * feature on, it must not suddenly message every customer it has ever served.
 */
export const REVIEW_REQUEST_DELAY_DAYS = 3;
export const REVIEW_REQUEST_MAX_AGE_DAYS = 30;

const DAY_MS = 86_400_000;

export function reviewRequestWindow(now: Date = new Date()): { notAfter: Date; notBefore: Date } {
  return {
    notAfter: new Date(now.getTime() - REVIEW_REQUEST_DELAY_DAYS * DAY_MS),
    notBefore: new Date(now.getTime() - REVIEW_REQUEST_MAX_AGE_DAYS * DAY_MS),
  };
}

/** True when something finished at `finishedAt` is due its review request right now. */
export function isDueForReviewRequest(finishedAt: Date, now: Date = new Date()): boolean {
  const { notAfter, notBefore } = reviewRequestWindow(now);
  return finishedAt <= notAfter && finishedAt >= notBefore;
}
