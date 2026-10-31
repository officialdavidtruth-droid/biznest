/**
 * The one definition of how a plain product's stock level and its published flag
 * interact. updateProduct, bulk edit and CSV import used to carry their own copies
 * that had drifted apart; every path now calls this instead.
 *
 * Rules:
 *  - Running out (stock goes from above zero to zero) takes the listing down.
 *    It is flagged `autoUnpublished` only when the automation did the unpublishing,
 *    not when the merchant had already hidden it (or hid it in the same edit).
 *  - A restock republishes only a listing the automation took down, and never
 *    overrides a publish choice the merchant made in the same edit.
 *  - "Explicit" means the merchant changed the published flag in this edit. A form or
 *    an exported CSV row always echoes the current flag back, so an unchanged echo
 *    must not count as a decision.
 */
export type PublishDecisionInput = {
  /** Published state before this change. */
  wasPublished: boolean;
  /** The merchant changed the published flag in this same edit. */
  explicitPublish: boolean;
  /** The flag they asked for (only meaningful when explicitPublish is true). */
  requestedPublished: boolean;
  prevQuantity: number;
  nextQuantity: number;
  /** The out-of-stock automation (not the merchant) took the listing down earlier. */
  wasAutoUnpublished: boolean;
};

export type PublishDecision = {
  isPublished: boolean;
  autoUnpublished: boolean;
  justRanOut: boolean;
  justRestocked: boolean;
};

export function decidePublishAfterStockChange(i: PublishDecisionInput): PublishDecision {
  const justRanOut = i.prevQuantity > 0 && i.nextQuantity === 0;
  const justRestocked = i.prevQuantity === 0 && i.nextQuantity > 0;
  const wanted = i.explicitPublish ? i.requestedPublished : i.wasPublished;

  const autoTakeDown = justRanOut && wanted;
  const isPublished = justRanOut ? false : justRestocked && i.wasAutoUnpublished && !i.explicitPublish ? true : wanted;
  const autoUnpublished = autoTakeDown ? true : justRestocked ? false : i.wasAutoUnpublished;

  return { isPublished, autoUnpublished, justRanOut, justRestocked };
}
