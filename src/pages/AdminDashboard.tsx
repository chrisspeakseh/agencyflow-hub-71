import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, UserX, UserCheck, Loader2, UserPlus, KeyRound } from "lucide-react";
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
  
  // Create user state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("staff");
  
  // Reset password state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserName, setResetUserName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const fetchProfiles = useCallback(async () => {
    try {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role")
      ]);

      if (profilesResult.error) throw profilesResult.error;

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
      setProfiles(prev => prev.map(p => 
        p.id === userId ? { ...p, is_active: !currentStatus } : p
      ));
      toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      setProfiles(prev => prev.map(p => 
        p.id === userId ? { ...p, roles: [newRole] } : p
      ));
      toast.success("User role updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update user role");
      await fetchProfiles();
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error("Please fill all fields");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newUserEmail, password: newUserPassword, fullName: newUserName, role: newUserRole }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`User ${newUserEmail} created successfully!`);
      setCreateDialogOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("staff");
      await fetchProfiles();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: resetUserId, newPassword }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`Password reset for ${resetUserName}. They'll be required to change it on next login.`);
      setResetDialogOpen(false);
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 mb-2" />
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (currentUserRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />Access Denied
            </CardTitle>
            <CardDescription>Admin access required.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Create a new user account. They will be required to change their password on first login.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Full Name</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" /></div>
              <div><Label>Email</Label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@example.com" /></div>
              <div><Label>Password</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Temporary password" /></div>
              <div><Label>Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateUser} disabled={creating}>{creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Reset password for {resetUserName}. They will be required to change it on next login.</DialogDescription>
          </DialogHeader>
          <div><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New temporary password" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>{resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
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
                      <Avatar className="h-8 w-8"><AvatarImage src={profile.avatar_url || ""} /><AvatarFallback>{profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()}</AvatarFallback></Avatar>
                      <span className="font-medium">{profile.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Select value={profile.roles[0] || "staff"} onValueChange={(value) => updateUserRole(profile.id, value)} disabled={updatingRole === profile.id}>
                      <SelectTrigger className="w-[120px]">{updatingRole === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}</SelectTrigger>
                      <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Badge variant={profile.is_active ? "default" : "secondary"}>{profile.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setResetUserId(profile.id); setResetUserName(profile.full_name); setResetDialogOpen(true); }}>
                        <KeyRound className="h-4 w-4 mr-1" />Reset PW
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleUserStatus(profile.id, profile.is_active)} disabled={updatingStatus === profile.id}>
                        {updatingStatus === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : profile.is_active ? <><UserX className="h-4 w-4 mr-1" />Deactivate</> : <><UserCheck className="h-4 w-4 mr-1" />Activate</>}
                      </Button>
                    </div>
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
