import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkEdgeRateLimit } from "../_shared/rateLimiter.ts";

const REVENUECAT_WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  try {
    // 0. Enforce IP-based rate limiting on public webhook
    const rateCheck = checkEdgeRateLimit(req, "revenuecat_webhook", {
      maxRequests: 60,
      windowSeconds: 60,
    });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Too many requests.",
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateCheck.retryAfterSeconds.toString(),
          },
        }
      );
    }

    // 1. Verify RevenueCat Webhook Authorization Header (Fail-Closed Security)
    const authHeader = req.headers.get("Authorization");
    if (!REVENUECAT_WEBHOOK_AUTH_HEADER || authHeader !== REVENUECAT_WEBHOOK_AUTH_HEADER) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook payload: Invalid or missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return new Response(JSON.stringify({ error: "Payload must be a valid JSON object" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = payload?.event;
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return new Response(JSON.stringify({ error: "Payload missing required 'event' object" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ALLOWED_EVENT_TYPES = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "CANCELLATION",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE",
      "EXPIRATION",
      "BILLING_ISSUE",
      "PRODUCT_CHANGE",
      "TRANSFER",
      "TEST",
    ];

    const eventType = event.type;
    if (typeof eventType !== "string" || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      return new Response(JSON.stringify({ error: `Rejected: Unrecognized or invalid event type '${eventType}'` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const appUserId = event.app_user_id;
    if (!appUserId || typeof appUserId !== "string" || appUserId.trim().length === 0 || appUserId.length > 256) {
      return new Response(JSON.stringify({ error: "Rejected: 'app_user_id' must be a valid non-empty string under 256 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (/[\u0000-\u001F\u007F-\u009F]/.test(appUserId)) {
      return new Response(JSON.stringify({ error: "Rejected: 'app_user_id' contains forbidden control characters" }), {
        status: 400,
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
      return new Response(JSON.stringify({ error: "Internal processing error" }), {
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
