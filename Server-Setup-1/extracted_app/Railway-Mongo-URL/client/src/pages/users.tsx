import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Shield,
  ShieldOff,
  RotateCcw,
  UserCheck,
  UserX,
  Eye,
} from "lucide-react";
import { createUserSchema, type CreateUserInput, type IUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

function isOnline(lastLogin: string | null | undefined): boolean {
  if (!lastLogin) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return new Date(lastLogin).getTime() > fiveMinutesAgo;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordDialogOpen, setTempPasswordDialogOpen] = useState(false);
  const [tempPasswordLabel, setTempPasswordLabel] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCountdown, setConfirmCountdown] = useState(3);
  const [confirmReady, setConfirmReady] = useState(false);

  useEffect(() => {
    if (!confirmOpen) return;
    setConfirmCountdown(3);
    setConfirmReady(false);
    const interval = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setConfirmReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmOpen]);

  const openConfirm = useCallback((message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }, []);

  const { data: usersData, isLoading } = useQuery<{ success: boolean; data: { users: IUser[]; total: number; page: number; pageSize: number } }>({
    queryKey: ["/api/admin/users"],
  });

  const users = usersData?.data?.users || [];

  const filtered = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? u.isActive : !u.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const adminCount = users.filter((u) => u.role === "ADMIN" && u.isActive).length;

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", password: "", role: "EMPLOYEE" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return { response: await res.json(), plainPassword: data.password };
    },
    onSuccess: ({ plainPassword }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateOpen(false);
      form.reset();
      setTempPasswordLabel("New User Password");
      setTempPassword(plainPassword);
      setTempPasswordDialogOpen(true);
      toast({ title: "User created successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to create user", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update user", description: err.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/reset-password`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const tempPw = data.data?.temporaryPassword;
      if (tempPw) {
        setTempPasswordLabel("Temporary Password");
        setTempPassword(tempPw);
        setTempPasswordDialogOpen(true);
      }
      toast({ title: "Password reset", description: tempPw ? `Temporary password: ${tempPw}` : "Check response" });
    },
    onError: (err: Error) => toast({ title: "Failed to reset password", description: err.message, variant: "destructive" }),
  });

  const handleToggle = (user: IUser) => {
    if (user.isActive) {
      if (user.role === "ADMIN" && adminCount <= 1) {
        toast({ title: "Cannot deactivate", description: "This is the last active admin.", variant: "destructive" });
        return;
      }
      openConfirm(`Are you sure you want to deactivate "${user.username}"?`, () => {
        toggleMutation.mutate({ id: user._id, isActive: false });
      });
    } else {
      toggleMutation.mutate({ id: user._id, isActive: true });
    }
  };

  const handleRoleToggle = (user: IUser) => {
    if (user.role === "ADMIN") {
      if (adminCount <= 1) {
        toast({ title: "Cannot change role", description: "This is the last admin. Promote another user first.", variant: "destructive" });
        return;
      }
      openConfirm(`Are you sure you want to revoke admin from "${user.username}"?`, () => {
        roleMutation.mutate({ id: user._id, role: "EMPLOYEE" });
      });
    } else {
      roleMutation.mutate({ id: user._id, role: "ADMIN" });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-2xl font-bold">Users</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-users-title">User Management</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-user">
          <Plus className="mr-1" /> Create User
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-search-users"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-role-filter">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((user) => (
                  <TableRow key={user._id} data-testid={`row-user-${user._id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${isOnline(user.lastLogin) ? "bg-green-500" : "bg-gray-400"}`}
                          title={isOnline(user.lastLogin) ? "Online" : "Offline"}
                          data-testid={`status-online-${user._id}`}
                        />
                        <span data-testid={`text-username-${user._id}`}>{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isActive ? "bg-green-600 text-white border-transparent" : "bg-gray-400 text-white border-transparent"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(user)}
                          title={user.isActive ? "Deactivate" : "Activate"}
                          data-testid={`button-toggle-${user._id}`}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRoleToggle(user)}
                          title="Toggle role"
                          data-testid={`button-role-${user._id}`}
                        >
                          {user.role === "ADMIN" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetPasswordMutation.mutate(user._id)}
                          title="Reset password"
                          data-testid={`button-reset-${user._id}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} data-testid="button-prev-page">
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} data-testid="button-next-page">
            Next
          </Button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl><Input {...field} data-testid="input-new-username" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" {...field} data-testid="input-new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-user">
                {createMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                Create User
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={tempPasswordDialogOpen} onOpenChange={setTempPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tempPasswordLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              Please copy this password now. It will not be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
            <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <code className="text-sm font-mono select-all" data-testid="text-temp-password">{tempPassword}</code>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-close-password">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!confirmReady}
              onClick={() => {
                confirmAction?.();
                setConfirmOpen(false);
              }}
              data-testid="button-confirm-action"
            >
              {confirmReady ? "Confirm" : `Wait ${confirmCountdown}s...`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
