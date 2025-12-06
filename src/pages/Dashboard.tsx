import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  brand_color: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  project_id: string;
  profiles?: {
    full_name: string;
  } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch role and member projects in parallel
      const [roleResult, memberResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("project_members").select("project_id").eq("user_id", user.id)
      ]);

      const userRole = roleResult.data?.role;
      const isAdminOrManager = userRole === "admin" || userRole === "manager";
      const memberProjectIds = memberResult.data?.map(p => p.project_id) || [];

      // If staff with no projects, show empty state immediately
      if (!isAdminOrManager && memberProjectIds.length === 0) {
        setLoading(false);
        return;
      }

      // Build queries based on role
      let projectsQuery = supabase.from("projects").select("id, name, brand_color, status").eq("status", "active").limit(5);
      let tasksQuery = supabase.from("tasks").select("id, title, due_date, status, project_id, profiles:profiles!tasks_assignee_id_fkey(full_name)").neq("status", "Done").limit(10);
      
      if (!isAdminOrManager) {
        projectsQuery = projectsQuery.in("id", memberProjectIds);
        tasksQuery = tasksQuery.in("project_id", memberProjectIds);
      }

      // Fetch projects and tasks in parallel
      const [projectsResult, tasksResult] = await Promise.all([
        projectsQuery,
        tasksQuery
      ]);

      setProjects(projectsResult.data || []);
      
      const allTasks = tasksResult.data || [];
      const now = new Date();
      
      // Split tasks into pending and overdue
      const pending: Task[] = [];
      const overdue: Task[] = [];
      
      allTasks.forEach(task => {
        if (task.due_date && new Date(task.due_date) < now) {
          overdue.push(task);
        } else {
          pending.push(task);
        }
      });

      setPendingTasks(pending.slice(0, 5));
      setOverdueTasks(overdue.slice(0, 5));
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Skeleton loading state - shows instantly
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-1 sm:p-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Agency Overview</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <Skeleton className="h-8 w-12 mb-2" />
                <Skeleton className="h-3 w-32 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-1 sm:p-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Agency Overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground mb-3">Currently in progress</p>
            <div className="space-y-1.5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50 hover:bg-muted cursor-pointer text-xs"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.brand_color }} />
                  <span className="truncate font-medium">{project.name}</span>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">No active projects</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl font-bold">{pendingTasks.length}</div>
            <p className="text-xs text-muted-foreground mb-3">Awaiting completion</p>
            <div className="space-y-1.5">
              {pendingTasks.map((task) => (
                <div key={task.id} className="p-1.5 rounded-md bg-muted/50 text-xs">
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}
                    {task.profiles && <span className="truncate">• {task.profiles.full_name}</span>}
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <p className="text-xs text-muted-foreground">No pending tasks</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl font-bold text-destructive">{overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground mb-3">Need attention</p>
            <div className="space-y-1.5">
              {overdueTasks.map((task) => (
                <div key={task.id} className="p-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
                  <div className="font-medium truncate text-destructive">{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-destructive">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}
                    {task.profiles && <span className="truncate">• {task.profiles.full_name}</span>}
                  </div>
                </div>
              ))}
              {overdueTasks.length === 0 && (
                <p className="text-xs text-muted-foreground">No overdue tasks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;