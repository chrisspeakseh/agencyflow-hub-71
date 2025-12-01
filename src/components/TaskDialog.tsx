import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/config/appConfig";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: any;
  onTaskCreated: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  onTaskCreated,
}: TaskDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [projectName, setProjectName] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "Todo",
    priority: "P2-Medium",
    assignee_id: null as string | null,
    due_date: null as Date | null,
    is_blocked: false,
  });

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchProjectName();
      if (task) {
        setFormData({
          title: task.title || "",
          description: task.description || "",
          status: task.status || "Todo",
          priority: task.priority || "P2-Medium",
          assignee_id: task.assignee_id || "",
          due_date: task.due_date ? new Date(task.due_date) : null,
          is_blocked: task.is_blocked || false,
        });
      } else {
        setFormData({
          title: "",
          description: "",
          status: "Todo",
          priority: "P2-Medium",
          assignee_id: null,
          due_date: null,
          is_blocked: false,
        });
      }
    }
  }, [open, task]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, profiles(id, full_name, email)")
        .eq("project_id", projectId);

      if (error) throw error;

      const members = data
        .map((m: any) => m.profiles)
        .filter(Boolean) as Profile[];
      setTeamMembers(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchProjectName = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProjectName(data.name);
    } catch (error) {
      console.error("Error fetching project name:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const taskData = {
        ...formData,
        project_id: projectId,
        due_date: formData.due_date?.toISOString(),
      } as any;

      let result;
      if (task) {
        result = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("tasks")
          .insert(taskData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Send email notification if task is assigned
      if (formData.assignee_id && !task) {
        const assignee = teamMembers.find((m) => m.id === formData.assignee_id);
        if (assignee) {
          try {
            await supabase.functions.invoke("send-task-notification", {
              body: {
                taskId: result.data.id,
                taskTitle: formData.title,
                assigneeEmail: assignee.email,
                assigneeName: assignee.full_name,
                projectName: projectName,
                dueDate: formData.due_date?.toISOString(),
                priority: formData.priority,
              },
            });
          } catch (emailError) {
            console.error("Error sending notification:", emailError);
            // Don't fail the whole operation if email fails
          }
        }
      }

      toast({
        title: task ? "Task updated" : "Task created",
        description: task
          ? "Task has been updated successfully"
          : "Task has been created successfully",
      });

      onTaskCreated();
    } catch (error: any) {
      console.error("Error saving task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter task description"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select
              value={formData.assignee_id || "unassigned"}
              onValueChange={(value) =>
                setFormData({ ...formData, assignee_id: value === "unassigned" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No team members. Add members to the project first.
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? (
                    format(formData.due_date, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date || undefined}
                  onSelect={(date) =>
                    setFormData({ ...formData, due_date: date || null })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="blocked"
              checked={formData.is_blocked}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_blocked: checked })
              }
            />
            <Label htmlFor="blocked">Task is blocked</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Update" : "Create"} Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
