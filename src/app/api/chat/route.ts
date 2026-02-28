import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// --- System Prompt ---

const SYSTEM_PROMPT = `You are an expert AI scheduling assistant called Meridian.
Your job is to extract actionable tasks and events from the user's natural-language input.
You MUST always respond with valid json only. Never include any other text outside the json.

Rules:
1. Extract EVERY distinct task or event mentioned.
2. Infer reasonable defaults when not explicitly stated:
   - Meetings default to 30 minutes, focus/deep-work to 60 minutes, personal to 30 minutes.
   - Priority defaults to "medium" unless urgency cues suggest otherwise.
3. Keep titles concise (2-6 words).
4. For time_constraint, preserve the user's phrasing (e.g. "tomorrow afternoon"). Use an empty string if none.
5. Choose category based on context: "meeting", "focus", or "personal".
6. If the user's message is conversational or doesn't contain schedulable items, return an empty tasks array.

You must return a json object with a single key "tasks" containing an array of task objects.
Each task object MUST have these fields:
- title (string)
- duration_minutes (number)
- priority (string: "low", "medium", or "high")
- time_constraint (string)
- category (string: "meeting", "focus", or "personal")

Example json response:
{"tasks": [{"title": "Team Standup", "duration_minutes": 30, "priority": "high", "time_constraint": "tomorrow morning", "category": "meeting"}]}`;

// --- Route Handler ---

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: true, message: "No API key configured. Please set the OPENAI_API_KEY environment variable.", tasks: [] },
      { status: 500 }
    );
  }

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

  const baseURL = process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.OPENAI_MODEL || "deepseek-chat";
  const openai = new OpenAI({ apiKey, baseURL });

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1024,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    let parsed: { tasks: unknown[] };

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { tasks: [] };
    }

    return NextResponse.json({
      error: false,
      message: null,
      tasks: parsed.tasks ?? [],
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown API error";
    console.error("[ai-scheduler] OpenAI API error:", errorMessage);
    return NextResponse.json(
      { error: true, message: `AI service error: ${errorMessage}`, tasks: [] },
      { status: 502 }
    );
  }
}
