import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { TaskDialog } from "./TaskDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  is_blocked: boolean;
  assignee_id: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CalendarViewProps {
  projectId: string;
  refreshKey?: number;
}

export function CalendarView({ projectId, refreshKey }: CalendarViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, [projectId, refreshKey]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          profiles:assignee_id (
            full_name,
            avatar_url
          )
        `)
        .eq("project_id", projectId)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdated = () => {
    fetchTasks();
    setIsEditDialogOpen(false);
  };

  const tasksForSelectedDate = tasks.filter(
    (task) => task.due_date && selectedDate && isSameDay(new Date(task.due_date), selectedDate)
  );

  const datesWithTasks = tasks
    .filter((task) => task.due_date)
    .map((task) => new Date(task.due_date!));

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Task Calendar</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                hasTask: datesWithTasks,
              }}
              modifiersStyles={{
                hasTask: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                },
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksForSelectedDate.length > 0 ? (
              <div className="space-y-3">
                {tasksForSelectedDate.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedTask(task);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium line-clamp-1">{task.title}</h4>
                        <Badge
                          variant={getPriorityColor(task.priority)}
                          className="text-xs shrink-0"
                        >
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {task.status}
                        </Badge>
                        {task.profiles && (
                          <span className="text-xs text-muted-foreground">
                            {task.profiles.full_name}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tasks due on this date
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedTask && (
        <TaskDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          projectId={projectId}
          task={selectedTask}
          onTaskCreated={handleTaskUpdated}
        />
      )}
    </>
  );
}
