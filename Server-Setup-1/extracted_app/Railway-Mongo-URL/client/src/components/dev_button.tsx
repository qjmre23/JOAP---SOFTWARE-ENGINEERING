import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DevWipeButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setCountdown(8);
      return;
    }
    if (!confirmed) {
      setCountdown(8);
      return;
    }
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, confirmed, countdown]);

  const handleWipe = async () => {
    setIsWiping(true);
    try {
      const res = await apiRequest("POST", "/api/maintenance/wipe");
      const data = await res.json();
      if (data.success) {
        toast({ title: "System wiped", description: "All data has been deleted." });
        queryClient.invalidateQueries();
        setOpen(false);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: "Wipe failed", description: err.message, variant: "destructive" });
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        data-testid="button-dev-wipe"
      >
        <Trash2 className="mr-1 h-4 w-4" /> Developer Only - Wipe All Data
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> DANGER: Complete System Wipe
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL data from the system including items, orders, customers, payments, logs, backups, and uploaded images. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive font-medium">
              WARNING: This will erase everything. Only use this for development/testing purposes.
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm-wipe"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(!!v)}
                data-testid="checkbox-confirm-wipe"
              />
              <label htmlFor="confirm-wipe" className="text-sm font-medium cursor-pointer">
                I understand this will delete ALL data permanently
              </label>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!confirmed || countdown > 0 || isWiping}
              onClick={handleWipe}
              data-testid="button-confirm-wipe"
            >
              {isWiping ? (
                <><Loader2 className="animate-spin mr-1 h-4 w-4" /> Wiping...</>
              ) : countdown > 0 && confirmed ? (
                `Confirm Wipe (${countdown}s)`
              ) : (
                "Confirm Wipe"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
