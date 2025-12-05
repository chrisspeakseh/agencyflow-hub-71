import { supabase } from "@/integrations/supabase/client";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}

export async function createNotification({
  userId,
  title,
  message,
  type,
  link,
}: CreateNotificationParams) {
  try {
    // Use service role through edge function to bypass RLS
    // Since users can only insert notifications for themselves,
    // we need to call this from the context of the target user
    // For now, we'll create the notification directly if the current user is the target
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user?.id === userId) {
      // User is creating notification for themselves - allowed by RLS
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        link,
      });
      if (error) throw error;
    } else {
      // For notifications to other users, we need to use an edge function
      // that has service role access
      await supabase.functions.invoke("create-notification", {
        body: { userId, title, message, type, link },
      });
    }
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export async function createNotificationForUser(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
) {
  try {
    await supabase.functions.invoke("create-notification", {
      body: { userId, title, message, type, link },
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
