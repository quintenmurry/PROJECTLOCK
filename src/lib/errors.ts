export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> };

/** Turn a Supabase/Postgres error into something safe and useful to show a user. */
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "42501":
      return err.message && err.message !== "Not allowed"
        ? err.message
        : "You don't have permission to do that.";
    case "22023":
    case "23505":
    case "54000":
    case "P0002":
      return err.message ?? "That request couldn't be completed.";
    default:
      console.error("[action error]", err);
      return "Something went wrong. Please try again.";
  }
}
