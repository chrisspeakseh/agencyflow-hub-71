-- Add "Pending Client Review" to task_status enum
ALTER TYPE public.task_status ADD VALUE 'Pending Client Review';

-- Add created_by column to tasks table for tracking who created the task
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Add force_password_change column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

-- Create task_logs table for comprehensive logging
CREATE TABLE public.task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  action_type text NOT NULL,
  old_value text,
  new_value text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_logs
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view logs for tasks they have access to
CREATE POLICY "Users can view logs for accessible tasks"
ON public.task_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_logs.task_id
    AND (
      has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR is_project_member(auth.uid(), tasks.project_id)
    )
  )
);

-- RLS policy: Project members can insert logs
CREATE POLICY "Project members can insert logs"
ON public.task_logs
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_logs.task_id
    AND (
      has_role(auth.uid(), 'admin') 
      OR is_project_member(auth.uid(), tasks.project_id)
    )
  )
);

-- Create index for faster log queries
CREATE INDEX idx_task_logs_task_id ON public.task_logs(task_id);
CREATE INDEX idx_task_logs_action_type ON public.task_logs(action_type);
CREATE INDEX idx_task_logs_created_at ON public.task_logs(created_at DESC);