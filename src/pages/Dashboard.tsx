import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  profiles?: {
    full_name: string;
  } | null;
}

interface DashboardStats {
  activeProjects: number;
  pendingTasks: number;
  overdueTasks: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingTasks: 0,
    overdueTasks: 0,
  });
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
      if (!user) return;

      // Check user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const userRole = roleData?.role;
      const isAdminOrManager = userRole === "admin" || userRole === "manager";

      // Fetch active projects count
      let projectsQuery = supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (!isAdminOrManager) {
        // Staff: only show projects they're part of
        const { data: memberProjects } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id);
        
        const projectIds = memberProjects?.map(p => p.project_id) || [];
        if (projectIds.length === 0) {
          setStats({ activeProjects: 0, pendingTasks: 0, overdueTasks: 0 });
          setLoading(false);
          return;
        }
        projectsQuery = projectsQuery.in("id", projectIds);
      }

      const { count: projectsCount } = await projectsQuery;

      // Fetch pending tasks count
      let pendingQuery = supabase
        .from("tasks")
        .select("project_id", { count: "exact", head: true })
        .neq("status", "Done");

      if (!isAdminOrManager) {
        const { data: memberProjects } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id);
        
        const projectIds = memberProjects?.map(p => p.project_id) || [];
        if (projectIds.length > 0) {
          pendingQuery = pendingQuery.in("project_id", projectIds);
        }
      }

      const { count: pendingCount } = await pendingQuery;

      // Fetch overdue tasks count
      const now = new Date().toISOString();
      let overdueQuery = supabase
        .from("tasks")
        .select("project_id", { count: "exact", head: true })
        .lt("due_date", now)
        .neq("status", "Done");

      if (!isAdminOrManager) {
        const { data: memberProjects } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id);
        
        const projectIds = memberProjects?.map(p => p.project_id) || [];
        if (projectIds.length > 0) {
          overdueQuery = overdueQuery.in("project_id", projectIds);
        }
      }

      const { count: overdueCount } = await overdueQuery;

      setStats({
        activeProjects: projectsCount || 0,
        pendingTasks: pendingCount || 0,
        overdueTasks: overdueCount || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
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
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
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
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl font-bold">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground mb-3">Awaiting completion</p>
            <div className="space-y-1.5">
              {pendingTasks.map((task) => (
                <div key={task.id} className="p-1.5 rounded-md bg-muted/50 text-xs">
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                    {task.due_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(task.due_date), "MMM d")}</span>}
                    {task.profiles && <span className="truncate">• {task.profiles.full_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-2xl font-bold text-destructive">{stats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground mb-3">Need attention</p>
            <div className="space-y-1.5">
              {overdueTasks.map((task) => (
                <div key={task.id} className="p-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
                  <div className="font-medium truncate text-destructive">{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                    {task.due_date && <span className="flex items-center gap-1 text-destructive"><Calendar className="h-3 w-3" />{format(new Date(task.due_date), "MMM d")}</span>}
                    {task.profiles && <span className="truncate">• {task.profiles.full_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
