-- Drop existing SELECT policies for projects
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Members can view their projects" ON public.projects;

-- Create new SELECT policy that allows admins AND managers to see all projects
CREATE POLICY "Admins and managers can view all projects" 
ON public.projects 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can only see their own projects
CREATE POLICY "Staff can view their projects" 
ON public.projects 
FOR SELECT 
USING (
  is_project_member(auth.uid(), id) AND 
  NOT has_role(auth.uid(), 'admin'::app_role) AND 
  NOT has_role(auth.uid(), 'manager'::app_role)
);

-- Update tasks SELECT policy to allow managers to see all tasks
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;

CREATE POLICY "Users can view tasks in their projects" 
ON public.tasks 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  is_project_member(auth.uid(), project_id)
);

-- Update project_members SELECT policy to allow managers to see all members
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;

CREATE POLICY "Users can view project members" 
ON public.project_members 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  is_project_member(auth.uid(), project_id)
);