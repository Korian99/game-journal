/** Keep reminders from older clients that omit the private per-playthrough field. */
export function reminderForSave(
  incoming: string | undefined,
  previous: string | undefined,
  provided: boolean,
): string {
  return provided ? incoming ?? "" : previous ?? "";
}
