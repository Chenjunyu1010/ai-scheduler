// ─── Types ───────────────────────────────────────────────────────────────────

export type NewTask = {
  title: string;
  duration_minutes: number;
  priority: "low" | "medium" | "high";
  time_constraint: string;
  category: "meeting" | "focus" | "personal";
};

export type CalendarEvent = {
  id: number;
  title: string;
  subtitle: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  color: string;
  tag: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "HH:MM" to minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:MM" */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CATEGORY_COLORS: Record<string, string> = {
  meeting: "bg-blue-50 border-blue-300 text-blue-900",
  focus: "bg-amber-50 border-amber-300 text-amber-900",
  personal: "bg-green-50 border-green-300 text-green-900",
};

const CATEGORY_TAGS: Record<string, string> = {
  meeting: "Meeting",
  focus: "Focus",
  personal: "Personal",
};

// ─── Scheduler ───────────────────────────────────────────────────────────────

type FreeSlot = { start: number; end: number };

/**
 * Find free time slots between existing events and assign start/end times
 * to each new task. Tasks are placed in priority order (high → medium → low)
 * into the earliest available gap that fits.
 */
export function scheduleTasks(
  newTasks: NewTask[],
  existingEvents: CalendarEvent[],
  dayStart = "08:00",
  dayEnd = "22:00",
): CalendarEvent[] {
  const dayStartMin = timeToMinutes(dayStart);
  const dayEndMin = timeToMinutes(dayEnd);

  // Sort existing events by start time (as minutes)
  const occupied = [...existingEvents]
    .map((ev) => ({
      start: timeToMinutes(ev.startTime),
      end: timeToMinutes(ev.endTime),
    }))
    .sort((a, b) => a.start - b.start);

  // Build list of free slots by scanning gaps
  const freeSlots: FreeSlot[] = [];
  let cursor = dayStartMin;

  for (const ev of occupied) {
    if (ev.start > cursor) {
      freeSlots.push({ start: cursor, end: ev.start });
    }
    cursor = Math.max(cursor, ev.end);
  }

  if (cursor < dayEndMin) {
    freeSlots.push({ start: cursor, end: dayEndMin });
  }

  // Sort tasks by priority (high first)
  const prioritized = [...newTasks].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  const scheduled: CalendarEvent[] = [];
  // Mutable copy of slots so we can consume capacity as tasks are placed
  const slots = freeSlots.map((s) => ({ ...s }));

  for (const task of prioritized) {
    const duration = task.duration_minutes;
    let placed = false;

    for (const slot of slots) {
      const available = slot.end - slot.start;
      if (available >= duration) {
        const startMin = slot.start;
        const endMin = startMin + duration;

        scheduled.push({
          id: Date.now() + Math.floor(Math.random() * 10000) + scheduled.length,
          title: task.title,
          subtitle: `${task.duration_minutes}min · ${task.priority} priority`,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          color: CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.meeting,
          tag: CATEGORY_TAGS[task.category] ?? "Meeting",
        });

        // Shrink the slot from the front
        slot.start = endMin;
        placed = true;
        break;
      }
    }

    if (!placed) {
      console.warn(
        `[scheduler] No free slot for "${task.title}" (${duration}min)`,
      );
    }
  }

  return scheduled;
}
