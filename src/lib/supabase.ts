import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client ─────────────────────────────────────────────────────────
//
// This client is ready to use once you create an `events` table in your
// Supabase dashboard. Run this SQL in the Supabase SQL Editor:
//
//   create table events (
//     id          bigint generated always as identity primary key,
//     title       text not null,
//     subtitle    text,
//     start_time  text not null,   -- "HH:MM"
//     end_time    text not null,   -- "HH:MM"
//     color       text,
//     tag         text,
//     created_at  timestamptz default now()
//   );
//
// Then swap the localStorage calls in page.tsx for supabase queries.
// ──────────────────────────────────────────────────────────────────────────────

const supabaseUrl = "https://wzfjlwckehnolonnzzbi.supabase.co";
const supabaseAnonKey = "sb_publishable_Fq7UdbyJbfpgmTYj-M1oCw_oFniobtf";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
