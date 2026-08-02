/**
 * Standard return shape for server actions (lib/actions/**). Keeping this in
 * one place means every form component can handle actions the same way:
 *   if (!result.success) { toast.error(result.error); return; }
 */
export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
