-- Fix 1: Remove overly permissive notification INSERT policy
-- Replace with a policy that only allows service role or self-notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive INSERT policy
-- Only allow users to insert notifications for themselves (for self-notifications)
-- System notifications should be created via edge functions using service role key
CREATE POLICY "Users can insert own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Fix 2: Restrict profile visibility
-- The current policy "Users can view all profiles" exposes all emails
-- In a team app context, users need to see team members, but we should be explicit about it
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Allow users to view profiles of people they share a project with
CREATE POLICY "Users can view team members profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.id
  )
);

-- Allow admins and managers to view all profiles (they need this for team management)
CREATE POLICY "Admins and managers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);