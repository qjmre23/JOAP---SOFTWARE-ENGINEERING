import { useState, useEffect } from "react";
import { Hammer, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      verifyToken(t);
    } else {
      setIsVerifying(false);
      setError("No reset token provided");
    }
  }, []);

  const verifyToken = async (t: string) => {
    try {
      const res = await fetch(`/api/auth/verify-reset-token?token=${t}`);
      const data = await res.json();
      if (res.ok && data.data?.valid) {
        setTokenValid(true);
        setUsername(data.data.username || "");
      } else {
        setError(data.error || "Invalid or expired reset token");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        toast({ title: "Password Reset", description: "Your password has been reset successfully." });
      } else {
        setError(data.error || "Reset failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center rounded-md bg-primary p-3">
              <Hammer className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription className="mt-1">
              {success ? "Your password has been reset" : username ? `Resetting password for ${username}` : "Enter your new password"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isVerifying ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Verifying token...</span>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <Button className="w-full" onClick={() => { window.location.href = "/"; }}>
                Go to Login
              </Button>
            </div>
          ) : !tokenValid ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error || "Invalid or expired reset token"}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { window.location.href = "/"; }}>
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              {error && (
                <div className="text-sm text-destructive text-center">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || !newPassword || !confirmPassword}>
                {isLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
