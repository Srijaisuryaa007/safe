import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestLocationPayload {
  targetUserId: string;
  circleId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Authenticate caller
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized caller" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;
    const body: RequestLocationPayload = await req.json();
    const { targetUserId, circleId } = body;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "targetUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerId === targetUserId) {
      return new Response(JSON.stringify({ error: "Cannot ping own location" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate Peer Circle Membership (trusted contacts only)
    const { data: membershipMatch, error: memErr } = await supabaseAdmin
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", callerId);

    const callerCircles = (membershipMatch || []).map((m: any) => m.circle_id);

    const { data: targetCirclesMatch } = await supabaseAdmin
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", targetUserId)
      .in("circle_id", callerCircles);

    if (!targetCirclesMatch || targetCirclesMatch.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Target is not in any of your verified circles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activeSharedCircleId = circleId || targetCirclesMatch[0].circle_id;

    // 3. Granular Privacy & Pause-Sharing Check
    const { data: perms } = await supabaseAdmin
      .from("location_sharing_permissions")
      .select("is_enabled, paused_until")
      .eq("user_id", targetUserId)
      .or(`target_id.eq.${callerId},target_id.eq.${activeSharedCircleId}`);

    if (perms && perms.length > 0) {
      for (const p of perms) {
        if (!p.is_enabled) {
          return new Response(
            JSON.stringify({ error: "Location sharing paused by member for privacy" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (p.paused_until && new Date(p.paused_until) > new Date()) {
          return new Response(
            JSON.stringify({ 
              error: "Location sharing temporarily paused", 
              pausedUntil: p.paused_until 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 4. Anti-Spam Rate Limiter (Max 1 location ping per 45s between the same pair)
    const { data: recentRequests } = await supabaseAdmin
      .from("location_requests")
      .select("id, requested_at")
      .eq("requester_id", callerId)
      .eq("target_user_id", targetUserId)
      .gt("requested_at", new Date(Date.now() - 45000).toISOString())
      .limit(1);

    if (recentRequests && recentRequests.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please wait 45 seconds between location requests.",
          retryAfterSec: 45
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Query Target's Last Known Location & Telemetry
    const { data: lastLoc } = await supabaseAdmin
      .from("locations")
      .select("latitude, longitude, updated_at, battery_pct, is_driving, speed_mps")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const lastKnownLatitude = lastLoc?.latitude ?? null;
    const lastKnownLongitude = lastLoc?.longitude ?? null;
    const lastKnownUpdatedAt = lastLoc?.updated_at ?? null;

    // 6. Record Pending Location Request in Database (Expires in 30 seconds)
    const expiresAt = new Date(Date.now() + 30000).toISOString();
    const { data: createdReq, error: reqInsertErr } = await supabaseAdmin
      .from("location_requests")
      .insert({
        requester_id: callerId,
        target_user_id: targetUserId,
        circle_id: activeSharedCircleId,
        status: "pending",
        expires_at: expiresAt,
        last_known_latitude: lastKnownLatitude,
        last_known_longitude: lastKnownLongitude,
        last_known_updated_at: lastKnownUpdatedAt,
      })
      .select()
      .single();

    if (reqInsertErr || !createdReq) {
      throw new Error(`Failed to create location request: ${reqInsertErr?.message}`);
    }

    // 7. Resolve Caller's Name for Push Notification
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .maybeSingle();

    const callerName = callerProfile?.full_name || "A trusted contact";

    // 8. Fetch Target User's Active Push Token(s)
    const { data: targetTokens } = await supabaseAdmin
      .from("push_tokens")
      .select("expo_push_token, platform")
      .eq("user_id", targetUserId);

    let tokensToSend: string[] = (targetTokens || []).map((t: any) => t.expo_push_token).filter(Boolean);

    // Fallback to profiles.push_token if not in push_tokens
    if (tokensToSend.length === 0) {
      const { data: targetProf } = await supabaseAdmin
        .from("profiles")
        .select("push_token")
        .eq("id", targetUserId)
        .maybeSingle();
      if (targetProf?.push_token) {
        tokensToSend.push(targetProf.push_token);
      }
    }

    let pushDispatched = false;
    let pushError: string | null = null;

    // 9. Dispatch High-Priority Silent Wake-up Push (FCM Data / APNs content-available)
    if (tokensToSend.length > 0) {
      const pushMessages = tokensToSend.map((token) => ({
        to: token,
        priority: "high",
        // Crucial for iOS background wake-up without playing sound or showing notification
        _contentAvailable: true,
        // Crucial for Android high-priority FCM data message execution
        _displayInForeground: false,
        sound: undefined,
        data: {
          type: "LOCATION_PING",
          requestId: createdReq.id,
          requesterId: callerId,
          requesterName: callerName,
          expiresAt,
          timestamp: Date.now(),
        },
      }));

      try {
        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushMessages),
        });

        const expoData = await expoRes.json();
        pushDispatched = true;

        // Check for invalid tokens and cleanup automatically
        if (expoData?.data && Array.isArray(expoData.data)) {
          for (let i = 0; i < expoData.data.length; i++) {
            const ticket = expoData.data[i];
            if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
              const deadToken = tokensToSend[i];
              await supabaseAdmin.from("push_tokens").delete().eq("expo_push_token", deadToken);
              await supabaseAdmin.from("profiles").update({ push_token: null }).eq("push_token", deadToken);
            }
          }
        }
      } catch (err: any) {
        pushError = err.message;
        console.warn("[request-location] Push dispatch failed:", err);
      }
    } else {
      pushError = "Target user has no registered push token";
    }

    // Compute human-readable relative timestamp for last known location
    let lastSeenLabel = "No prior location recorded";
    if (lastKnownUpdatedAt) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(lastKnownUpdatedAt).getTime()) / 60000));
      lastSeenLabel = minutesAgo < 60 
        ? `Last updated ${minutesAgo} min ago` 
        : `Last updated ${Math.round(minutesAgo / 60)} hr ago`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: createdReq.id,
        status: "pending",
        expiresAt,
        timeoutSeconds: 30,
        pushDispatched,
        pushError,
        lastKnownLocation: {
          latitude: lastKnownLatitude,
          longitude: lastKnownLongitude,
          updatedAt: lastKnownUpdatedAt,
          label: lastSeenLabel,
          batteryPct: lastLoc?.battery_pct ?? null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
