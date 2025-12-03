import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, AlertCircle, GripVertical } from "lucide-react";
import { format } from "date-fns";

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

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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

  // Check if task is overdue
  const isOverdue = task.due_date && 
    new Date(task.due_date) < new Date() && 
    task.status !== "Done";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-destructive bg-destructive/5' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2 mb-2 sm:mb-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium mb-2 line-clamp-2">{task.title}</h4>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {task.description}
              </p>
            )}
            {task.comments && (
              <p className="text-xs text-muted-foreground line-clamp-1 italic">
                💬 {task.comments}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
              {task.priority}
            </Badge>
            {task.is_blocked && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Blocked
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                OVERDUE
              </Badge>
            )}
          </div>

          {task.profiles && (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.profiles.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {task.profiles.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {task.due_date && (
          <div className={`flex items-center gap-1 mt-3 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3" />
            <span>{format(new Date(task.due_date), "MMM dd, yyyy")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
