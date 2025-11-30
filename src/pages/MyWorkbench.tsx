import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { TaskDialog } from "@/components/TaskDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  is_blocked: boolean;
  project_id: string;
  projects: {
    name: string;
    brand_color: string;
  };
}

export default function MyWorkbench() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const fetchMyTasks = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects (
            name,
            brand_color
          )
        `)
        .eq("assignee_id", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load your tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdated = () => {
    fetchMyTasks();
    setIsEditDialogOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "P1-High":
        return "destructive" as const;
      case "P2-Medium":
        return "warning" as const;
      case "P3-Low":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "Done") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "In Progress") return <Clock className="h-4 w-4 text-warning" />;
    return null;
  };

  const todoTasks = tasks.filter((t) => t.status === "Todo");
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress");
  const reviewTasks = tasks.filter((t) => t.status === "Internal Review");
  const doneTasks = tasks.filter((t) => t.status === "Done");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Workbench</h1>
          <p className="text-muted-foreground mt-1">
            All tasks assigned to you across projects
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todoTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reviewTasks.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{doneTasks.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                You don't have any assigned tasks yet
              </p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedTask(task);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{task.title}</h4>
                            {getStatusIcon(task.status)}
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: task.projects.brand_color,
                                color: task.projects.brand_color,
                              }}
                            >
                              {task.projects.name}
                            </Badge>
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {task.status}
                            </Badge>
                            {task.is_blocked && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            )}
                          </div>
                        </div>
                        {task.due_date && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(task.due_date), "MMM dd")}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedTask && (
        <TaskDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          projectId={selectedTask.project_id}
          task={selectedTask}
          onTaskCreated={handleTaskUpdated}
        />
      )}
    </>
  );
}
