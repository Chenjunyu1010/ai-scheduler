import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ─── Structured Output JSON Schema ──────────────────────────────────────────

const TASK_SCHEMA = {
  name: "scheduled_tasks",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: {
              type: "string" as const,
              description: "Short, descriptive title for the task or event",
            },
            duration_minutes: {
              type: "number" as const,
              description:
                "Estimated duration in minutes. Use reasonable defaults (30 for meetings, 60 for focus blocks, etc.)",
            },
            priority: {
              type: "string" as const,
              enum: ["low", "medium", "high"],
              description: "Priority level inferred from urgency cues",
            },
            time_constraint: {
              type: "string" as const,
              description:
                'Natural-language timing hint, e.g. "tomorrow morning", "after lunch". Use empty string if none.',
            },
            category: {
              type: "string" as const,
              enum: ["meeting", "focus", "personal"],
              description: "Best-fit category for the task",
            },
          },
          required: [
            "title",
            "duration_minutes",
            "priority",
            "time_constraint",
            "category",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["tasks"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are an expert AI scheduling assistant called Meridian.
Your job is to extract actionable tasks and events from the user's natural-language input.

Rules:
1. Extract EVERY distinct task or event mentioned.
2. Infer reasonable defaults when not explicitly stated:
   - Meetings default to 30 minutes, focus/deep-work to 60 minutes, personal to 30 minutes.
   - Priority defaults to "medium" unless urgency cues suggest otherwise.
3. Keep titles concise (2-6 words).
4. For time_constraint, preserve the user's phrasing (e.g. "tomorrow afternoon"). Use an empty string if no timing is mentioned.
5. Choose category based on context:
   - "meeting" → calls, syncs, 1:1s, reviews with other people
   - "focus" → deep work, coding, writing, research, studying
   - "personal" → breaks, errands, exercise, meals, appointments
6. If the user's message is conversational or doesn't contain schedulable items, return an empty tasks array.`;

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: true,
        message:
          "No API key configured. Please set the OPENAI_API_KEY environment variable (supports OpenAI or DeepSeek-compatible endpoints).",
        tasks: [],
      },
      { status: 500 }
    );
  }

  // 2. Parse request body
  let userMessage: string;
  try {
    const body = await request.json();
    userMessage = body.message?.trim();
    if (!userMessage) {
      return NextResponse.json(
        { error: true, message: "Message cannot be empty.", tasks: [] },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: true, message: "Invalid request body.", tasks: [] },
      { status: 400 }
    );
  }

  // 3. Initialise OpenAI client (DeepSeek-compatible by default)
  const baseURL =
    process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.OPENAI_MODEL || "deepseek-chat";

  const openai = new OpenAI({ apiKey, baseURL });

  // 4. Call the API with structured output
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: TASK_SCHEMA,
      },
      temperature: 0.3,
      max_tokens: 1024,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { tasks: unknown[] };

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { tasks: [] };
    }

    return NextResponse.json({
      error: false,
      message: null,
      tasks: parsed.tasks ?? [],
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown API error";
    console.error("[ai-scheduler] OpenAI API error:", errorMessage);
    return NextResponse.json(
      {
        error: true,
        message: `AI service error: ${errorMessage}`,
        tasks: [],
      },
      { status: 502 }
    );
  }
}
