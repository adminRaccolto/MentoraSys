import { createClient } from "@supabase/supabase-js";

// Cliente com service_role — bypassa RLS, use apenas em Server Actions
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
