import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, message, type, link }: NotificationRequest = await req.json();

    if (!userId || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating notification for user ${userId}: ${title}`);

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type: type || "info",
      link: link || null,
    });

    if (error) {
      console.error("Error creating notification:", error);
      throw error;
    }

    console.log("Notification created successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
