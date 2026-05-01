import { useState } from "react";
import { Hammer, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage({ onBack }: { onBack?: () => void } = {}) {
  const goBack = onBack || (() => { window.location.href = "/"; });
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        if (data.error === "Please contact your admin") {
          toast({ title: "Access Denied", description: "Employee accounts cannot reset passwords. Please contact your admin.", variant: "destructive" });
        }
      } else {
        setSent(true);
        toast({ title: "Email Sent", description: "Check your email for the password reset link." });
      }
    } catch {
      setError("Network error. Please try again.");
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
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription className="mt-1">
              {sent ? "Check your email for the reset link" : "Enter your username to receive a password reset email"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
                <p className="text-sm text-green-700 dark:text-green-300">
                  If an admin account with that username exists and has an email address on file, a password reset link has been sent.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="text-sm text-destructive text-center">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || !username.trim()}>
                {isLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={goBack} type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
