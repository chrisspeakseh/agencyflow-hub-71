import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createNotificationForUser } from "@/lib/notifications";

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface ProjectMember extends Profile {
  membership_id: string;
}

export function TeamMembersDialog({
  open,
  onOpenChange,
  projectId,
}: TeamMembersDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (open) {
      fetchAllUsers();
      fetchProjectMembers();
    }
  }, [open, projectId]);

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, user_id, profiles(id, full_name, email)")
        .eq("project_id", projectId);

      if (error) throw error;

      const members = data
        .map((m: any) => ({
          ...m.profiles,
          membership_id: m.id,
        }))
        .filter(Boolean) as ProjectMember[];
      
      setProjectMembers(members);
    } catch (error) {
      console.error("Error fetching project members:", error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("project_members")
        .insert({
          project_id: projectId,
          user_id: selectedUserId,
        });

      if (error) throw error;

      // Get project name and user details for email
      const { data: projectData } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();

      const member = allUsers.find(u => u.id === selectedUserId);

      if (projectData && member) {
        // Create in-app notification
        await createNotificationForUser(
          member.id,
          "Added to Project",
          `You have been added to the project "${projectData.name}"`,
          "project_member",
          `/projects/${projectId}`
        );

        // Send email notification (non-blocking)
        supabase.functions.invoke("send-project-member-notification", {
          body: {
            memberEmail: member.email,
            memberName: member.full_name,
            projectName: projectData.name,
            action: "added",
          },
        }).catch(console.error);
      }

      toast({
        title: "Member added",
        description: "Team member has been added to the project",
      });

      setSelectedUserId("");
      fetchProjectMembers();
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    setLoading(true);
    try {
      // Get member details before removing
      const memberToRemove = projectMembers.find(m => m.membership_id === membershipId);
      
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", membershipId);

      if (error) throw error;

      // Send removal notification
      if (memberToRemove) {
        const { data: projectData } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();

        if (projectData) {
          // Create in-app notification
          await createNotificationForUser(
            memberToRemove.id,
            "Removed from Project",
            `You have been removed from the project "${projectData.name}"`,
            "project_member"
          );

          // Send email notification (non-blocking)
          supabase.functions.invoke("send-project-member-notification", {
            body: {
              memberEmail: memberToRemove.email,
              memberName: memberToRemove.full_name,
              projectName: projectData.name,
              action: "removed",
            },
          }).catch(console.error);
        }
      }

      toast({
        title: "Member removed",
        description: "Team member has been removed from the project",
      });

      fetchProjectMembers();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !projectMembers.some((member) => member.id === user.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Team Members</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Member Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Add Team Member</h3>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddMember}
                disabled={!selectedUserId || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Current Members Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              Current Members ({projectMembers.length})
            </h3>
            <div className="space-y-2">
              {projectMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team members yet. Add members to start collaborating.
                </p>
              ) : (
                projectMembers.map((member) => (
                  <div
                    key={member.membership_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{member.full_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {member.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.membership_id)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
