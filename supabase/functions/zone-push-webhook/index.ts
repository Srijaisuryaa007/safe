import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ZoneEventRecord {
  id: string;
  circle_id: string;
  member_id: string;
  zone_id: string;
  type: "EXIT" | "ENTER";
  occurred_at: string;
  received_at: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Support both direct payloads and Supabase Database Webhook envelope
    const record: ZoneEventRecord = body?.record || body;

    if (!record || !record.id || !record.circle_id || !record.member_id || !record.zone_id || !record.type || !record.occurred_at) {
      return new Response(JSON.stringify({ error: "Missing required zone event fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch exiting/entering member's profile
    const { data: memberProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", record.member_id)
      .single();

    const memberName = memberProfile?.full_name || "Circle Member";

    // 2. Fetch safe zone place name
    const { data: zonePlace } = await supabaseAdmin
      .from("places")
      .select("name")
      .eq("id", record.zone_id)
      .single();

    const zoneName = zonePlace?.name || "Safe Zone";

    // 3. Find other circle members & guardians (NEVER the member who left)
    const { data: circleMembers, error: membersErr } = await supabaseAdmin
      .from("circle_members")
      .select("user_id, role")
      .eq("circle_id", record.circle_id)
      .neq("user_id", record.member_id);

    if (membersErr || !circleMembers || circleMembers.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients to notify in this circle", sentCount: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const recipientUserIds = circleMembers.map((m: any) => m.user_id);

    // 4. Fetch all active push tokens for these recipients
    const { data: tokenRows, error: tokensErr } = await supabaseAdmin
      .from("push_tokens")
      .select("id, user_id, expo_push_token, timezone")
      .in("user_id", recipientUserIds);

    if (tokensErr || !tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ message: "No registered push tokens for circle members", sentCount: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Parse authentic occurred_at and calculate delay
    const occurredDate = new Date(record.occurred_at);
    const receivedDate = new Date(record.received_at || Date.now());
    const isDelayed = (receivedDate.getTime() - occurredDate.getTime()) > (2 * 60 * 1000); // > 2 minutes
    const isExit = record.type === "EXIT";

    // 6. Build personalized push messages per recipient timezone
    const pushMessages: any[] = [];
    const tokenIndexMap: string[] = []; // maps message index to expo_push_token for receipt error handling

    for (const row of tokenRows) {
      const recipientTz = row.timezone || "UTC";
      let timeStr = "recently";

      try {
        timeStr = new Intl.DateTimeFormat("en-US", {
          timeZone: recipientTz,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(occurredDate);
      } catch {
        // Fallback if timezone string is malformed
        timeStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(occurredDate) + " UTC";
      }

      const title = isExit
        ? `${memberName} left ${zoneName} • ${timeStr}`
        : `${memberName} arrived at ${zoneName} • ${timeStr}`;

      let bodyText = isExit
        ? `${memberName} left ${zoneName} at ${timeStr}.`
        : `${memberName} arrived at ${zoneName} at ${timeStr}.`;

      if (isDelayed) {
        bodyText += " (delayed)";
      }

      pushMessages.push({
        to: row.expo_push_token,
        title,
        body: bodyText,
        sound: "default",
        priority: "high",
        channelId: "safe-zone",
        _contentAvailable: true,
        data: {
          type: isExit ? "zone_exit" : "zone_enter",
          eventId: record.id,
          memberId: record.member_id,
          zoneId: record.zone_id,
          occurredAt: record.occurred_at,
        },
      });

      tokenIndexMap.push(row.expo_push_token);
    }

    // 7. Send in batches of 100 to Expo Push API
    const invalidTokensToDelete: string[] = [];
    const EXPO_CHUNK_SIZE = 100;
    let sentCount = 0;

    for (let i = 0; i < pushMessages.length; i += EXPO_CHUNK_SIZE) {
      const chunk = pushMessages.slice(i, i + EXPO_CHUNK_SIZE);
      const chunkTokens = tokenIndexMap.slice(i, i + EXPO_CHUNK_SIZE);

      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (expoRes.ok) {
        const expoData = await expoRes.json();
        const tickets = expoData?.data || [];

        tickets.forEach((ticket: any, idx: number) => {
          if (ticket.status === "ok") {
            sentCount++;
          } else if (ticket.status === "error") {
            console.warn(`[ExpoPush] Ticket error for token ${chunkTokens[idx]}:`, ticket.message, ticket.details);
            if (ticket.details?.error === "DeviceNotRegistered") {
              invalidTokensToDelete.push(chunkTokens[idx]);
            }
          }
        });
      } else {
        const errText = await expoRes.text();
        console.error("[ExpoPush] Batch send failed:", expoRes.status, errText);
      }
    }

    // 8. Auto-clean expired / invalid tokens
    if (invalidTokensToDelete.length > 0) {
      console.log(`[ExpoPush] Pruning ${invalidTokensToDelete.length} unregistered tokens`);
      await supabaseAdmin
        .from("push_tokens")
        .delete()
        .in("expo_push_token", invalidTokensToDelete);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        sentCount,
        recipientsCount: recipientUserIds.length,
        delayed: isDelayed,
        event: {
          id: record.id,
          type: record.type,
          occurred_at: record.occurred_at,
          member: memberName,
          zone: zoneName,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[ZonePushWebhook] Internal error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
