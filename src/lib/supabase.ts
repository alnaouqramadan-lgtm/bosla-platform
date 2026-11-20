import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
if (!supabaseUrl || !anonKey) {
  throw new Error("Set the two NEXT_PUBLIC_SUPABASE variables for the independent planning database.");
}
export const supabase = createClient(supabaseUrl, anonKey);
