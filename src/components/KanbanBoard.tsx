import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TASK_STATUSES } from "@/config/appConfig";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { AlertCircle } from "lucide-react";
import { createNotificationForUser } from "@/lib/notifications";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  is_blocked: boolean;
  assignee_id: string | null;
  comments: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface KanbanBoardProps {
  projectId: string;
  refreshKey?: number;
}

interface StatusColumnProps {
  status: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

function StatusColumn({ status, tasks, onTaskClick }: StatusColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`flex flex-col transition-colors w-[280px] shrink-0 sm:w-auto sm:shrink ${isOver ? 'ring-2 ring-primary' : ''}`}
    >
      <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
        <CardTitle className="text-xs sm:text-sm font-medium flex items-center justify-between">
          <span className="truncate">{status}</span>
          <Badge variant="secondary" className="ml-2 text-xs">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 sm:space-y-3 min-h-[150px] sm:min-h-[200px] p-2 sm:p-6 pt-0 sm:pt-0">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 sm:py-8">
            No tasks
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ projectId, refreshKey }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Touch-friendly sensors for mobile drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const fetchTasks = useCallback(async () => {
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
        .order("created_at", { ascending: false });

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
  }, [projectId, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshKey]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus as any })
        .eq("id", taskId);

      if (error) throw error;

      // Get task assignees and notify them about status change
      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("user_id")
        .eq("task_id", taskId);

      const { data: { user } } = await supabase.auth.getUser();

      if (assignees && assignees.length > 0) {
        // Get project name for the notification
        const { data: projectData } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();

        const projectName = projectData?.name || "Unknown Project";

        // Notify all assignees except the current user
        assignees.forEach(({ user_id }) => {
          if (user_id !== user?.id) {
            createNotificationForUser(
              user_id,
              "Task Status Updated",
              `Task "${task.title}" in project "${projectName}" moved from "${oldStatus}" to "${newStatus}"`,
              "task_status",
              `/projects/${projectId}`
            );
          }
        });
      }

      toast({
        title: "Task updated",
        description: "Task status has been updated",
      });
    } catch (error: any) {
      console.error("Error updating task:", error);
      fetchTasks();
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  const handleTaskUpdated = () => {
    fetchTasks();
    setIsEditDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex gap-3 sm:gap-6 overflow-x-auto pb-4 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible -mx-2 px-2 sm:mx-0 sm:px-0">
        {TASK_STATUSES.map((status) => (
          <Card key={status} className="w-[280px] shrink-0 sm:w-auto sm:shrink">
            <CardHeader className="pb-2 p-3 sm:p-6">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Mobile: horizontal scroll with proper padding, Desktop: grid */}
        <div className="flex gap-3 sm:gap-6 overflow-x-auto pb-4 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible -mx-2 px-2 sm:mx-0 sm:px-0">
          {TASK_STATUSES.map((status) => {
            const statusTasks = tasks.filter((task) => task.status === status);
            return (
              <StatusColumn 
                key={status} 
                status={status} 
                tasks={statusTasks}
                onTaskClick={handleTaskClick}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <Card className="opacity-90 rotate-3 cursor-grabbing shadow-xl w-[250px]">
              <CardContent className="p-3 sm:p-4">
                <h4 className="font-medium mb-2 text-sm">{activeTask.title}</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {activeTask.priority}
                  </Badge>
                  {activeTask.is_blocked && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Blocked
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

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