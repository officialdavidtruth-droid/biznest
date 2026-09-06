export type LedgerMovementForReconciliation = {
  id: string;
  quantityChange: number;
  quantityAfter: number;
};

export type StockLedgerReconciliation = {
  status: "OK" | "DISCREPANCY" | "LEDGER_CORRUPT" | "NO_LEDGER";
  storedQuantity: number;
  ledgerQuantity: number | null;
  openingQuantity: number | null;
  movementCount: number;
  discrepancy: number;
  errors: string[];
};

/**
 * Reconciles the running-balance ledger without assuming the first recorded
 * movement was created from zero. This is important for legacy inventory that
 * existed before StockMovement history was introduced.
 */
export function reconcileStockLedger(
  storedQuantity: number,
  movements: LedgerMovementForReconciliation[],
): StockLedgerReconciliation {
  if (movements.length === 0) {
    return {
      status: "NO_LEDGER",
      storedQuantity,
      ledgerQuantity: null,
      openingQuantity: null,
      movementCount: 0,
      discrepancy: 0,
      errors: ["No stock movements exist for this stock item; its opening balance cannot be independently verified."],
    };
  }

  const errors: string[] = [];
  const openingQuantity = movements[0].quantityAfter - movements[0].quantityChange;
  let previousAfter = openingQuantity;

  for (const movement of movements) {
    if (!Number.isInteger(movement.quantityChange) || !Number.isInteger(movement.quantityAfter)) {
      errors.push(`Movement ${movement.id} contains a non-integer quantity.`);
      continue;
    }
    if (movement.quantityAfter !== previousAfter + movement.quantityChange) {
      errors.push(`Movement ${movement.id} breaks the running balance.`);
    }
    if (movement.quantityAfter < 0) {
      errors.push(`Movement ${movement.id} records a negative on-hand quantity.`);
    }
    previousAfter = movement.quantityAfter;
  }

  const ledgerQuantity = movements[movements.length - 1].quantityAfter;
  const discrepancy = storedQuantity - ledgerQuantity;
  if (discrepancy !== 0) errors.push(`Stored quantity differs from the ledger by ${discrepancy} unit${Math.abs(discrepancy) === 1 ? "" : "s"}.`);

  return {
    status: errors.some((error) => error.includes("breaks the running balance") || error.includes("negative") || error.includes("non-integer"))
      ? "LEDGER_CORRUPT"
      : discrepancy === 0
        ? "OK"
        : "DISCREPANCY",
    storedQuantity,
    ledgerQuantity,
    openingQuantity,
    movementCount: movements.length,
    discrepancy,
    errors,
  };
}
