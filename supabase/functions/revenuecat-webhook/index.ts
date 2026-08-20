import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REVENUECAT_WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  try {
    // 1. Verify RevenueCat Webhook Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (REVENUECAT_WEBHOOK_AUTH_HEADER && authHeader !== REVENUECAT_WEBHOOK_AUTH_HEADER) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook payload" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const event = payload?.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload structure" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventType = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
    const appUserId = event.app_user_id;

    if (!appUserId) {
      return new Response(JSON.stringify({ message: "No app_user_id present. Skipping." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Execute SQL webhook procedure using Service Role Admin privileges
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabaseAdmin.rpc("handle_revenuecat_webhook", {
      event_type: eventType,
      target_user_id: appUserId,
    });

    if (error) {
      console.error("[RevenueCat Webhook] Error calling RPC:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, event_type: eventType, user_id: appUserId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[RevenueCat Webhook] Internal Exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
