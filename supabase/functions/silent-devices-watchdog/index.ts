import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch circle members inactive for > 12 hours
    const { data: inactiveRows, error: queryErr } = await supabaseAdmin
      .from("inactive_circle_members")
      .select("*");

    if (queryErr) throw queryErr;
    if (!inactiveRows || inactiveRows.length === 0) {
      return new Response(JSON.stringify({ message: "No silent devices detected" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Group by circle to avoid spamming multiple alerts
    const alertsDispatched: any[] = [];

    for (const inactive of inactiveRows) {
      const { circle_id, user_id, full_name, last_latitude, last_longitude, last_seen_at, hours_silent } = inactive;

      // Find guardians/leaders of this circle to alert
      const { data: leaders } = await supabaseAdmin
        .from("circle_members")
        .select("user_id, profiles(push_token)")
        .eq("circle_id", circle_id)
        .in("role", ["owner", "co_leader", "guardian"])
        .neq("user_id", user_id);

      if (!leaders || leaders.length === 0) continue;

      const guardianTokens: string[] = [];
      for (const l of leaders) {
        const prof: any = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
        if (prof?.push_token) guardianTokens.push(prof.push_token);
      }

      if (guardianTokens.length > 0) {
        const roundedHours = Math.round(hours_silent || 12);
        const lastSeenDate = last_seen_at ? new Date(last_seen_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "recently";

        const pushMessages = guardianTokens.map((token) => ({
          to: token,
          sound: "default",
          priority: "high",
          title: `Status Advisory: ${full_name || "Member"}`,
          body: `No telemetry received for ${roundedHours} hours. Last seen at ${lastSeenDate}. Tap to view last known location.`,
          data: {
            type: "INACTIVITY_ADVISORY",
            memberId: user_id,
            lastLat: last_latitude,
            lastLng: last_longitude,
            lastSeenAt: last_seen_at,
          },
        }));

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushMessages),
        });

        alertsDispatched.push({ user_id, full_name, roundedHours, guardiansAlerted: guardianTokens.length });
      }
    }

    return new Response(
      JSON.stringify({ success: true, alertsDispatched }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
