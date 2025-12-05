import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, UserX, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  roles: string[];
}

const AdminDashboard = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      // Fetch profiles and roles in parallel
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role")
      ]);

      if (profilesResult.error) throw profilesResult.error;

      // Map roles to profiles
      const rolesMap = new Map<string, string[]>();
      (rolesResult.data || []).forEach((r) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      const profilesWithRoles = (profilesResult.data || []).map((profile) => ({
        ...profile,
        roles: rolesMap.get(profile.id) || [],
      }));

      setProfiles(profilesWithRoles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to load user data");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(data?.role || null);
      await fetchProfiles();
      setLoading(false);
    };

    init();
  }, [fetchProfiles]);

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setUpdatingStatus(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) throw error;

      // Update local state immediately
      setProfiles(prev => prev.map(p => 
        p.id === userId ? { ...p, is_active: !currentStatus } : p
      ));
      
      toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully`);
    } catch (error: any) {
      console.error("Error updating user status:", error);
      toast.error(error.message || "Failed to update user status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      // First delete existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      // Then insert the new role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: newRole as "admin" | "manager" | "staff",
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      // Update local state immediately
      setProfiles(prev => prev.map(p => 
        p.id === userId ? { ...p, roles: [newRole] } : p
      ));

      toast.success("User role updated successfully");
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast.error(error.message || "Failed to update user role");
      // Refetch to ensure consistency
      await fetchProfiles();
    } finally {
      setUpdatingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentUserRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page. Admin access required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users, roles, and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage all users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || ""} />
                        <AvatarFallback>
                          {profile.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{profile.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Select
                      value={profile.roles[0] || "staff"}
                      onValueChange={(value) => updateUserRole(profile.id, value)}
                      disabled={updatingRole === profile.id}
                    >
                      <SelectTrigger className="w-[120px]">
                        {updatingRole === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? "default" : "secondary"}>
                      {profile.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(profile.id, profile.is_active)}
                      disabled={updatingStatus === profile.id}
                    >
                      {updatingStatus === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : profile.is_active ? (
                        <>
                          <UserX className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
