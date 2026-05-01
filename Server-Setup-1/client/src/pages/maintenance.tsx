import { useState, useEffect, lazy, Suspense } from "react";
import {
  Wrench,
  Download,
  Upload,
  Loader2,
  Database,
  HardDrive,
  Clock,
  Settings,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const DevWipeButton = lazy(() => import("@/components/dev_button"));

export default function MaintenancePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadConfirmed, setUploadConfirmed] = useState(false);
  const [uploadCountdown, setUploadCountdown] = useState(5);
  const [isUploading, setIsUploading] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);

  const { data: backupSettings } = useQuery<{ success: boolean; data: { enabled: boolean; intervalValue: number; intervalUnit: string } }>({
    queryKey: ["/api/maintenance/auto-backup/settings"],
    enabled: isAdmin,
  });

  const { data: historyData } = useQuery<{ success: boolean; data: { history: Array<{ _id: string; filename: string; size: number; source: string; createdBy: string; createdAt: string }>; total: number } }>({
    queryKey: [`/api/maintenance/backup/history?page=${historyPage}&pageSize=5`],
    enabled: isAdmin,
  });

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalValue, setIntervalValue] = useState(24);
  const [intervalUnit, setIntervalUnit] = useState("hours");

  useEffect(() => {
    if (backupSettings?.data) {
      setAutoEnabled(backupSettings.data.enabled);
      setIntervalValue(backupSettings.data.intervalValue);
      setIntervalUnit(backupSettings.data.intervalUnit);
    }
  }, [backupSettings]);

  const saveAutoBackupMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; intervalValue: number; intervalUnit: string }) => {
      const res = await apiRequest("PATCH", "/api/maintenance/auto-backup/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/auto-backup/settings"] });
      toast({ title: "Auto backup settings saved" });
    },
    onError: (err: Error) => toast({ title: "Failed to save settings", description: err.message, variant: "destructive" }),
  });

  const triggerBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/maintenance/auto-backup/trigger");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/backup/history"] });
      toast({ title: "Backup created successfully" });
    },
    onError: (err: Error) => toast({ title: "Backup failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!uploadOpen) {
      setUploadConfirmed(false);
      setUploadCountdown(5);
      setUploadFile(null);
      return;
    }
    if (!uploadConfirmed) {
      setUploadCountdown(5);
      return;
    }
    if (uploadCountdown <= 0) return;
    const timer = setTimeout(() => setUploadCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [uploadOpen, uploadConfirmed, uploadCountdown]);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const res = await apiRequest("GET", "/api/maintenance/backup");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `joap-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadRestore = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const text = await uploadFile.text();
      const backupData = JSON.parse(text);
      const res = await apiRequest("POST", "/api/maintenance/backup/upload", backupData);
      const result = await res.json();
      if (result.success) {
        toast({ title: "Backup restored successfully" });
        queryClient.invalidateQueries();
        setUploadOpen(false);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadHistory = async (id: string, filename: string) => {
    try {
      const res = await apiRequest("GET", `/api/maintenance/backup/download/${id}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  const history = historyData?.data?.history || [];
  const totalHistory = historyData?.data?.total || 0;
  const hasMore = historyPage * 5 < totalHistory;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-maintenance-title">Maintenance</h1>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Data Backup
            </CardTitle>
            <CardDescription>
              Export or restore a complete backup of all system data as a JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Button
                onClick={handleExportBackup}
                disabled={isExporting}
                data-testid="button-export-backup"
              >
                {isExporting ? (
                  <Loader2 className="animate-spin mr-1" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                {isExporting ? "Exporting..." : "Download Backup"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(true)}
                data-testid="button-upload-backup"
              >
                <Upload className="mr-1 h-4 w-4" /> Upload Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Auto Backup
            </CardTitle>
            <CardDescription>
              Configure automatic backups at regular intervals. Backups are saved to the system and can be downloaded from the history below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Enable Auto Backup</span>
              <Switch
                checked={autoEnabled}
                onCheckedChange={setAutoEnabled}
                data-testid="switch-auto-backup"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Every</span>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={intervalValue}
                onChange={(e) => setIntervalValue(parseInt(e.target.value) || 1)}
                data-testid="input-backup-interval"
              />
              <Select value={intervalUnit} onValueChange={setIntervalUnit}>
                <SelectTrigger className="w-[120px]" data-testid="select-backup-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={() => saveAutoBackupMutation.mutate({ enabled: autoEnabled, intervalValue, intervalUnit })}
                disabled={saveAutoBackupMutation.isPending}
                data-testid="button-save-auto-backup"
              >
                {saveAutoBackupMutation.isPending && <Loader2 className="animate-spin mr-1 h-3 w-3" />}
                Save Settings
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerBackupMutation.mutate()}
                disabled={triggerBackupMutation.isPending}
                data-testid="button-trigger-backup"
              >
                {triggerBackupMutation.isPending && <Loader2 className="animate-spin mr-1 h-3 w-3" />}
                Create Backup Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> Auto Backup History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No backups yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm" data-testid={`backup-history-${h._id}`}>
                    <div>
                      <div className="font-medium">
                        {new Date(h.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.source === "auto" ? "Automatic" : "Manual"} | {(h.size / 1024).toFixed(1)} KB | by {h.createdBy}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadHistory(h._id, h.filename)}
                      data-testid={`button-download-${h._id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setHistoryPage((p) => p + 1)}
                    data-testid="button-show-more-history"
                  >
                    <ChevronDown className="mr-1 h-3 w-3" /> Show More
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> System Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application</span>
                <span className="font-medium">JOAP Hardware Trading SMS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment</span>
                <span className="font-medium">Production</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </CardTitle>
            <CardDescription>
              Developer tools for testing purposes only. These actions cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <DevWipeButton />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Restore from Backup
            </DialogTitle>
            <DialogDescription>
              Upload a JSON backup file to restore the system. This will overwrite all existing data with the backup data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive font-medium">
              WARNING: This will replace ALL existing data with the uploaded backup. Make sure you have a current backup before proceeding.
            </div>
            <Input
              type="file"
              accept=".json"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              data-testid="input-upload-backup-file"
            />
            {uploadFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm-restore"
                checked={uploadConfirmed}
                onCheckedChange={(v) => setUploadConfirmed(!!v)}
                data-testid="checkbox-confirm-restore"
              />
              <label htmlFor="confirm-restore" className="text-sm font-medium cursor-pointer">
                I understand this will overwrite all existing data
              </label>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!uploadFile || !uploadConfirmed || uploadCountdown > 0 || isUploading}
              onClick={handleUploadRestore}
              data-testid="button-confirm-restore"
            >
              {isUploading ? (
                <><Loader2 className="animate-spin mr-1 h-4 w-4" /> Restoring...</>
              ) : uploadCountdown > 0 && uploadConfirmed ? (
                `Confirm Restore (${uploadCountdown}s)`
              ) : (
                "Confirm Restore"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
