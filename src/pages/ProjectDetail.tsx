import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskDialog } from "@/components/TaskDialog";
import { TeamMembersDialog } from "@/components/TeamMembersDialog";
import { CalendarView } from "@/components/CalendarView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Calendar, LayoutGrid, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description: string | null;
  brand_color: string;
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchProject();
    fetchUserRole();
  }, [projectId]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setUserRole(data?.role || null);
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      console.error("Error fetching project:", error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = () => {
    setRefreshKey(prev => prev + 1);
    setIsTaskDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(userRole === "admin" || userRole === "manager") && (
            <Button variant="outline" onClick={() => setIsTeamDialogOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Manage Team
            </Button>
          )}
          <Button onClick={() => setIsTaskDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList>
          <TabsTrigger value="kanban">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Kanban Board
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          <KanbanBoard projectId={projectId!} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView projectId={projectId!} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        projectId={projectId!}
        onTaskCreated={handleTaskCreated}
      />

      <TeamMembersDialog
        open={isTeamDialogOpen}
        onOpenChange={setIsTeamDialogOpen}
        projectId={projectId!}
      />
    </div>
  );
}
