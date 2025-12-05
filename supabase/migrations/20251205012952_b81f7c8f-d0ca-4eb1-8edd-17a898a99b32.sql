-- Fix the project_members policy to allow managers to add members even if not yet a member
DROP POLICY IF EXISTS "Admins and managers can manage project members" ON public.project_members;

-- Allow admins full access, and managers can manage any project
CREATE POLICY "Admins and managers can manage project members" 
ON public.project_members 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));