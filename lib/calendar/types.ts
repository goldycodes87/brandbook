/**
 * Calendar integration seam.
 *
 * Today there is one provider: a read-only ICS feed that Google Calendar (or
 * Apple, or Outlook) subscribes to. Subscribing is one-way — the calendar
 * polls the feed, so editing a due date in BrandBook updates the calendar with
 * no further action.
 *
 * A future GoogleCalendarProvider implements the same interface and gains the
 * push methods, which the ICS provider declares unsupported. Nothing that
 * consumes CalendarEvent needs to change when that lands.
 */

export interface CalendarEvent {
  /** Stable across regenerations — reused as the ICS UID so edits update the
   *  existing calendar entry rather than creating a duplicate. */
  id: string
  title: string
  /** All-day date, YYYY-MM-DD. Ranch work is scheduled by day, not by time. */
  date: string
  description?: string | null
  /** Bumped when the event changes, so subscribers pick up edits. */
  updatedAt?: string | null
}

export interface CalendarProvider {
  readonly name: string
  /** True when the provider can write back to the user's calendar. ICS cannot. */
  readonly canPush: boolean
  /** Render the events for delivery (ICS text today). */
  render(events: CalendarEvent[], calendarName: string): string
  /** Implemented by push-capable providers such as Google. */
  push?(events: CalendarEvent[]): Promise<{ pushed: number }>
}
