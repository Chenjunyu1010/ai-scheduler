"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Clock,
  MoreHorizontal,
  Plus,
  Bot,
  User,
  Loader2,
  // AlertTriangle reserved for future error UI
  Flag,
  Timer,
  Tag,
} from "lucide-react";
import { scheduleTasks, timeToMinutes } from "@/lib/scheduler";
import type { CalendarEvent, NewTask } from "@/lib/scheduler";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScheduledTask = {
  title: string;
  duration_minutes: number;
  priority: "low" | "medium" | "high";
  time_constraint: string;
  category: "meeting" | "focus" | "personal";
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tasks?: ScheduledTask[];
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM – 10 PM
const DAY_START = "08:00";

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    title: "Design Review",
    subtitle: "Product team · Figma",
    startTime: "09:00",
    endTime: "10:00",
    color: "bg-blue-50 border-blue-300 text-blue-900",
    tag: "Meeting",
  },
  {
    id: 2,
    title: "Deep Work: Engineering",
    subtitle: "No interruptions · Do not disturb",
    startTime: "10:30",
    endTime: "12:30",
    color: "bg-amber-50 border-amber-300 text-amber-900",
    tag: "Focus",
  },
  {
    id: 3,
    title: "Lunch Break",
    subtitle: "Away · Personal time",
    startTime: "12:30",
    endTime: "13:15",
    color: "bg-green-50 border-green-300 text-green-900",
    tag: "Personal",
  },
  {
    id: 4,
    title: "1:1 with Sarah",
    subtitle: "Weekly check-in",
    startTime: "13:30",
    endTime: "14:00",
    color: "bg-purple-50 border-purple-300 text-purple-900",
    tag: "Meeting",
  },
  {
    id: 5,
    title: "Focus Work",
    subtitle: "Quarterly roadmap draft",
    startTime: "14:00",
    endTime: "16:30",
    color: "bg-amber-50 border-amber-300 text-amber-900",
    tag: "Focus",
  },
  {
    id: 6,
    title: "Team Standup",
    subtitle: "Engineering · Zoom",
    startTime: "17:00",
    endTime: "17:30",
    color: "bg-blue-50 border-blue-300 text-blue-900",
    tag: "Meeting",
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Good morning! I've reviewed your schedule for today. You have a focused morning with a Design Review at 9 AM, followed by a 2-hour deep work session. Want me to protect your afternoon for uninterrupted focus?",
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const HOUR_HEIGHT = 64; // px per hour

/** Convert a "HH:MM" time to a pixel offset from the top of the timeline */
function timeToTop(time: string): number {
  const mins = timeToMinutes(time);
  const dayStartMins = timeToMinutes(DAY_START);
  return ((mins - dayStartMins) / 60) * HOUR_HEIGHT;
}

/** Convert a duration between two "HH:MM" strings to pixel height */
function durationToHeight(start: string, end: string): number {
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  return ((endMins - startMins) / 60) * HOUR_HEIGHT;
}

// ─── Schedule Event Card ──────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const top = timeToTop(event.startTime);
  const height = Math.max(durationToHeight(event.startTime, event.endTime) - 4, 28);

  return (
    <div
      className={`absolute left-2 right-2 rounded-lg border-l-4 px-3 py-2 shadow-sm cursor-pointer
        transition-all duration-150 hover:shadow-md hover:-translate-y-px
        ${event.color}`}
      style={{ top, height }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight truncate">{event.title}</p>
          {height > 42 && (
            <p className="text-[11px] opacity-60 mt-0.5 truncate">{event.subtitle}</p>
          )}
        </div>
        <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 rounded p-0.5 hover:bg-black/5 shrink-0 mt-0.5">
          <MoreHorizontal size={12} />
        </button>
      </div>
      {height > 54 && (
        <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/60 uppercase tracking-wide">
          {event.tag}
        </span>
      )}
    </div>
  );
}

// ─── Parsed Task Card ──────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  low: "bg-zinc-100 text-zinc-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
} as const;

const CATEGORY_STYLES = {
  meeting: "bg-blue-100 text-blue-700",
  focus: "bg-amber-100 text-amber-700",
  personal: "bg-green-100 text-green-700",
} as const;

function TaskCard({ task }: { task: ScheduledTask }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="text-[13px] font-semibold text-zinc-900 leading-tight">{task.title}</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
          <Flag size={9} /> {task.priority}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_STYLES[task.category]}`}>
          <Tag size={9} /> {task.category}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
          <Timer size={9} /> {task.duration_minutes}m
        </span>
      </div>
      {task.time_constraint && (
        <p className="text-[11px] text-zinc-500 mt-1.5">
          <Clock size={10} className="inline -mt-px mr-0.5" /> {task.time_constraint}
        </p>
      )}
    </div>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
          ${isUser ? "bg-zinc-800 text-white" : "bg-blue-600 text-white"}`}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
            ${isUser
              ? "bg-zinc-800 text-white rounded-tr-sm"
              : "bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm shadow-sm"
            }`}
        >
          {msg.content}
          {msg.tasks && msg.tasks.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {msg.tasks.map((t, i) => (
                <TaskCard key={i} task={t} />
              ))}
            </div>
          )}
        </div>
        <span className="text-[10px] text-zinc-400 px-1">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window === "undefined") return INITIAL_EVENTS;
    try {
      const stored = localStorage.getItem("ai-scheduler-events");
      return stored ? (JSON.parse(stored) as CalendarEvent[]) : INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist events to localStorage on every change.
  // TODO: Replace with Supabase once the `events` table is created.
  //       See src/lib/supabase.ts for setup instructions.
  useEffect(() => {
    try {
      localStorage.setItem("ai-scheduler-events", JSON.stringify(events));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [events]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: data.message || "Something went wrong. Please try again.",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const tasks: ScheduledTask[] = data.tasks ?? [];

      // Schedule the new tasks into free slots on the calendar
      if (tasks.length > 0) {
        const newTasks: NewTask[] = tasks.map((t) => ({
          title: t.title,
          duration_minutes: t.duration_minutes,
          priority: t.priority,
          time_constraint: t.time_constraint,
          category: t.category,
        }));

        const newlyScheduled = scheduleTasks(newTasks, events);
        if (newlyScheduled.length > 0) {
          setEvents((prev) => [...prev, ...newlyScheduled]);
        }
      }

      const reply: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content:
          tasks.length > 0
            ? `I parsed ${tasks.length} task${tasks.length > 1 ? "s" : ""} from your request and scheduled ${tasks.length > 1 ? "them" : "it"} on your calendar:`
            : "I didn't find any schedulable tasks in your message. Try something like \"Team standup at 3 PM for 30 minutes\".",
        timestamp: new Date(),
        tasks: tasks.length > 0 ? tasks : undefined,
      };

      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Network error — could not reach the AI service. Please check your connection.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, events]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8f7f4]">
      {/* ── Top Nav ── */}
      <header className="h-12 shrink-0 bg-white border-b border-[#e4e2dc] flex items-center px-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Meridian</span>
        </div>

        <div className="h-4 w-px bg-zinc-200 mx-1" />

        {/* Date navigation */}
        <div className="flex items-center gap-1 text-sm text-zinc-600">
          <button className="p-1 rounded hover:bg-zinc-100 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <button className="px-2.5 py-0.5 rounded hover:bg-zinc-100 transition-colors font-medium text-zinc-800">
            Today
          </button>
          <button className="p-1 rounded hover:bg-zinc-100 transition-colors">
            <ChevronRight size={15} />
          </button>
          <span className="ml-1 text-zinc-400 font-normal hidden sm:inline">Saturday, Feb 28</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <Plus size={13} />
            <span className="hidden sm:inline">New Event</span>
          </button>
          <button className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
            <Calendar size={15} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

        {/* ── LEFT: Schedule Pane (2/3) ── */}
        <div className="flex flex-col flex-1 lg:w-2/3 min-h-0 border-r border-[#e4e2dc]">
          {/* Day header */}
          <div className="flex items-center px-4 py-2.5 bg-white border-b border-[#e4e2dc] shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-zinc-900 leading-none">28</div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest font-semibold text-blue-600">Saturday</span>
                <span className="text-[11px] text-zinc-400">February 2026</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock size={12} />
              <span>{events.length} events scheduled</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex min-h-0">
              {/* Time gutter */}
              <div className="w-14 shrink-0 select-none" style={{ paddingTop: 0 }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-3 text-[11px] text-zinc-400 font-medium"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="-translate-y-2">{formatHour(h)}</span>
                  </div>
                ))}
              </div>

              {/* Grid + Events */}
              <div
                className="relative flex-1 border-l border-[#e4e2dc]"
                style={{ height: HOURS.length * HOUR_HEIGHT }}
              >
                {/* Hour lines */}
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-[#e8e6e0]"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Half-hour lines (lighter) */}
                {HOURS.map((_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-dashed border-[#edecea]"
                    style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Current time indicator — positioned at ~10:15 AM for demo */}
                <div
                  className="absolute left-0 right-0 z-10 flex items-center gap-1 pointer-events-none"
                  style={{ top: 2.25 * HOUR_HEIGHT }}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 -translate-x-1 shrink-0" />
                  <div className="flex-1 h-px bg-blue-500" />
                </div>

                {/* Events */}
                {events.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Chat Pane (1/3) ── */}
        <div className="flex flex-col lg:w-1/3 min-h-0 bg-[#fafaf8] lg:max-h-full max-h-[45vh]">
          {/* Chat header */}
          <div className="px-4 py-3 bg-white border-b border-[#e4e2dc] shrink-0 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 leading-tight">AI Assistant</p>
              <p className="text-[10px] text-green-500 font-medium">● Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-white" />
                </div>
                <div className="rounded-2xl px-3.5 py-2.5 bg-white border border-zinc-100 rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin text-blue-500" />
                  <span className="text-sm text-zinc-400">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips */}
          <div className="px-4 pb-2 flex gap-2 flex-wrap shrink-0">
            {["Block focus time", "Find free slot", "Reschedule 1:1"].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="text-[11px] font-medium border border-zinc-200 rounded-full px-2.5 py-1
                  text-zinc-600 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50
                  transition-colors whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 shrink-0 bg-[#fafaf8]">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-zinc-200 shadow-sm
              focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your schedule…"
                className="flex-1 text-sm bg-transparent outline-none text-zinc-800 placeholder:text-zinc-400"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center
                  text-white transition-all hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed
                  active:scale-95 shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5">
              AI can make scheduling mistakes. Verify important events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
