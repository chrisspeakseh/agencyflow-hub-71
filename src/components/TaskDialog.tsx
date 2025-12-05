import { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { createNotificationForUser } from "@/lib/notifications";

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
    assignee_ids: [] as string[],
    due_date: null as Date | null,
    is_blocked: false,
    comments: "",
  });

  const fetchTeamMembers = useCallback(async () => {
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
  }, [projectId]);

  const fetchProjectName = useCallback(async () => {
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
  }, [projectId]);

  const fetchTaskAssignees = useCallback(async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_assignees")
        .select("user_id")
        .eq("task_id", taskId);

      if (error) throw error;
      setFormData(prev => ({ ...prev, assignee_ids: data.map(a => a.user_id) }));
    } catch (error) {
      console.error("Error fetching task assignees:", error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchProjectName();
      if (task) {
        fetchTaskAssignees(task.id);
        setFormData({
          title: task.title || "",
          description: task.description || "",
          status: task.status || "Todo",
          priority: task.priority || "P2-Medium",
          assignee_ids: [],
          due_date: task.due_date ? new Date(task.due_date) : null,
          is_blocked: task.is_blocked || false,
          comments: task.comments || "",
        });
      } else {
        setFormData({
          title: "",
          description: "",
          status: "Todo",
          priority: "P2-Medium",
          assignee_ids: [],
          due_date: null,
          is_blocked: false,
          comments: "",
        });
      }
    }
  }, [open, task, fetchTeamMembers, fetchProjectName, fetchTaskAssignees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { assignee_ids, ...taskData } = formData;
      const finalTaskData = {
        ...taskData,
        project_id: projectId,
        due_date: formData.due_date?.toISOString(),
      } as any;

      let result;
      if (task) {
        result = await supabase
          .from("tasks")
          .update(finalTaskData)
          .eq("id", task.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("tasks")
          .insert(finalTaskData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Handle assignees
      const taskId = task ? task.id : result.data.id;
      
      if (task) {
        const { data: previousAssignees } = await supabase
          .from("task_assignees")
          .select("user_id")
          .eq("task_id", task.id);
        
        const previousIds = previousAssignees?.map(a => a.user_id) || [];
        const addedIds = assignee_ids.filter(id => !previousIds.includes(id));
        const removedIds = previousIds.filter(id => !assignee_ids.includes(id));

        if (removedIds.length > 0) {
          await supabase
            .from("task_assignees")
            .delete()
            .eq("task_id", task.id)
            .in("user_id", removedIds);
          
          // Send unassignment notifications
          removedIds.forEach(userId => {
            const member = teamMembers.find(m => m.id === userId);
            if (member) {
              // Create in-app notification
              createNotificationForUser(
                userId,
                "Task Unassigned",
                `You have been unassigned from task "${formData.title}" in project "${projectName}"`,
                "task_assignment",
                `/projects/${projectId}`
              );

              // Send email notification (non-blocking)
              supabase.functions.invoke("send-assignment-notification", {
                body: {
                  taskId: task.id,
                  taskTitle: formData.title,
                  assigneeEmail: member.email,
                  assigneeName: member.full_name,
                  projectName,
                  dueDate: formData.due_date?.toISOString(),
                  priority: formData.priority,
                  action: "unassigned",
                },
              }).catch(console.error);
            }
          });
        }

        if (addedIds.length > 0) {
          const newAssignees = addedIds.map(userId => ({
            task_id: task.id,
            user_id: userId,
          }));
          await supabase.from("task_assignees").insert(newAssignees);

          addedIds.forEach(userId => {
            const member = teamMembers.find(m => m.id === userId);
            if (member) {
              // Create in-app notification
              createNotificationForUser(
                userId,
                "New Task Assigned",
                `You have been assigned to task "${formData.title}" in project "${projectName}"`,
                "task_assignment",
                `/projects/${projectId}`
              );

              // Send email notification (non-blocking)
              supabase.functions.invoke("send-assignment-notification", {
                body: {
                  taskId: task.id,
                  taskTitle: formData.title,
                  assigneeEmail: member.email,
                  assigneeName: member.full_name,
                  projectName,
                  dueDate: formData.due_date?.toISOString(),
                  priority: formData.priority,
                  action: "assigned",
                },
              }).catch(console.error);
            }
          });
        }
      } else if (assignee_ids.length > 0) {
        const newAssignees = assignee_ids.map(userId => ({
          task_id: taskId,
          user_id: userId,
        }));
        await supabase.from("task_assignees").insert(newAssignees);

        assignee_ids.forEach(userId => {
          const member = teamMembers.find(m => m.id === userId);
          if (member) {
            // Create in-app notification
            createNotificationForUser(
              userId,
              "New Task Assigned",
              `You have been assigned to task "${formData.title}" in project "${projectName}"`,
              "task_assignment",
              `/projects/${projectId}`
            );

            // Send email notification (non-blocking)
            supabase.functions.invoke("send-assignment-notification", {
              body: {
                taskId,
                taskTitle: formData.title,
                assigneeEmail: member.email,
                assigneeName: member.full_name,
                projectName,
                dueDate: formData.due_date?.toISOString(),
                priority: formData.priority,
                action: "assigned",
              },
            }).catch(console.error);
          }
        });
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{task ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter task title"
              required
              className="h-9 sm:h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter task description"
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments" className="text-sm">Comments</Label>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) =>
                setFormData({ ...formData, comments: e.target.value })
              }
              placeholder="Add any additional comments or notes"
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="h-9 sm:h-10">
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
              <Label className="text-sm">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger className="h-9 sm:h-10">
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
            <Label className="text-sm">Assign To (Multiple)</Label>
            <div className="border rounded-md p-2 sm:p-3 space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
              {teamMembers.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No team members. Add members to the project first.
                </p>
              ) : (
                teamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <Checkbox
                      checked={formData.assignee_ids.includes(member.id)}
                      onCheckedChange={(checked) => {
                        const newIds = checked
                          ? [...formData.assignee_ids, member.id]
                          : formData.assignee_ids.filter(id => id !== member.id);
                        setFormData({ ...formData, assignee_ids: newIds });
                      }}
                    />
                    <span className="text-xs sm:text-sm">{member.full_name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-9 sm:h-10 text-sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? (
                    format(formData.due_date, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
            <Label htmlFor="blocked" className="text-sm">Task is blocked</Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto h-9 sm:h-10"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto h-9 sm:h-10">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Update" : "Create"} Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}