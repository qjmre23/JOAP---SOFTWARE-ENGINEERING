import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Package,
  AlertCircle,
  AlertTriangle,
  Archive,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Upload,
  Trash2,
  LayoutGrid,
  List,
  ImageIcon,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { createItemSchema, inventoryLogSchema, type CreateItemInput, type InventoryLogInput, type IItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

function getStockStatus(item: IItem) {
  if (item.currentQuantity <= 0) return "Critical";
  if (item.currentQuantity <= item.reorderLevel) return "Low";
  return "Normal";
}

function StockBadge({ item }: { item: IItem }) {
  const status = getStockStatus(item);
  if (status === "Critical")
    return <Badge variant="destructive" data-testid={`badge-stock-${item._id}`}>Critical</Badge>;
  if (status === "Low")
    return <Badge className="bg-yellow-500 text-white border-transparent" data-testid={`badge-stock-${item._id}`}>Low</Badge>;
  return <Badge className="bg-green-600 text-white border-transparent" data-testid={`badge-stock-${item._id}`}>Normal</Badge>;
}

function ItemImage({ item, onUpload, onDelete, isAdmin }: { item: IItem; onUpload: (id: string, file: File) => void; onDelete?: (id: string) => void; isAdmin: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrl = (item as any).imageFilename ? `/api/uploads/${(item as any).imageFilename}` : null;
  const isPending = (item as any).imagePending;

  return (
    <div className="relative group">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.itemName}
          className="w-full h-32 object-cover rounded-md bg-muted"
          data-testid={`img-item-${item._id}`}
        />
      ) : (
        <div
          className="w-full h-32 rounded-md bg-muted flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-muted-foreground/20"
          onClick={() => fileRef.current?.click()}
          data-testid={`upload-area-${item._id}`}
        >
          <Upload className="h-6 w-6 text-muted-foreground/40 mb-1" />
          <span className="text-[10px] text-muted-foreground/50">Upload Image</span>
        </div>
      )}
      {isPending && !isAdmin && (
        <div className="absolute inset-0 bg-black/40 rounded-md flex items-center justify-center">
          <span className="text-[10px] text-white font-medium text-center px-2 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Waiting for admin approval
          </span>
        </div>
      )}
      {imageUrl && (
        <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => fileRef.current?.click()}
            data-testid={`button-replace-image-${item._id}`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {isAdmin && onDelete && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(item._id)}
              data-testid={`button-delete-image-${item._id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(item._id, file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function InventoryPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<IItem | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("inventory-view") as "grid" | "list") || "list";
  });

  const toggleView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("inventory-view", mode);
  };

  const { data: itemsData, isLoading } = useQuery<{ success: boolean; data: { items: IItem[]; total: number; page: number; pageSize: number } }>({
    queryKey: ["/api/items"],
  });

  const { data: categoriesData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/items/categories"],
  });

  const { data: approvalsData } = useQuery<{ success: boolean; data: Array<{ _id: string; itemId: string; filename: string; uploadedBy: string; item: IItem }> }>({
    queryKey: ["/api/image-approvals"],
    enabled: isAdmin,
  });

  const items = itemsData?.data?.items || [];
  const categories = categoriesData?.data || [];
  const pendingApprovals = approvalsData?.data || [];

  const filtered = items.filter((item) => {
    const matchSearch =
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalItems = items.length;
  const criticalStock = items.filter((i) => i.currentQuantity <= 0).length;
  const lowStock = items.filter((i) => i.currentQuantity > 0 && i.currentQuantity <= i.reorderLevel).length;
  const totalValue = items.reduce((acc, i) => acc + i.unitPrice * i.currentQuantity, 0);
  const formatCurrency = (v: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(v);

  const addForm = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { itemName: "", category: "", supplierName: "", unitPrice: 0, currentQuantity: 0, reorderLevel: 5 },
  });

  const addMutation = useMutation({
    mutationFn: async (data: CreateItemInput) => {
      const res = await apiRequest("POST", "/api/items", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items/categories"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Item created successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to create item", description: err.message, variant: "destructive" }),
  });

  const [adjustType, setAdjustType] = useState<string>("restock");
  const [newPrice, setNewPrice] = useState<number>(0);

  const restockForm = useForm<InventoryLogInput>({
    resolver: zodResolver(inventoryLogSchema),
    defaultValues: { itemId: "", type: "restock", quantity: 0, reason: "" },
  });

  const restockMutation = useMutation({
    mutationFn: async (data: InventoryLogInput) => {
      const res = await apiRequest("POST", "/api/inventory-logs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setRestockItem(null);
      restockForm.reset();
      setAdjustType("restock");
      toast({ title: "Inventory updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to update inventory", description: err.message, variant: "destructive" }),
  });

  const priceAdjustMutation = useMutation({
    mutationFn: async ({ id, unitPrice }: { id: string; unitPrice: number }) => {
      const res = await apiRequest("PATCH", `/api/items/${id}`, { unitPrice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setRestockItem(null);
      setAdjustType("restock");
      toast({ title: "Price updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to update price", description: err.message, variant: "destructive" }),
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`/api/items/${id}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/image-approvals"] });
      if (!isAdmin) {
        toast({ title: "Image uploaded", description: "Waiting for admin approval before it's visible." });
      } else {
        toast({ title: "Image uploaded successfully" });
      }
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/items/${id}/image`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Image deleted" });
    },
    onError: (err: Error) => toast({ title: "Failed to delete image", description: err.message, variant: "destructive" }),
  });

  const approveImageMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await apiRequest("PATCH", `/api/image-approvals/${id}`, { action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/image-approvals"] });
      toast({ title: "Image approval processed" });
    },
    onError: (err: Error) => toast({ title: "Failed to process approval", description: err.message, variant: "destructive" }),
  });

  const handleImageUpload = (id: string, file: File) => {
    uploadImageMutation.mutate({ id, file });
  };

  const handleAdjustSubmit = (data: InventoryLogInput) => {
    if (data.type === "deduction" && restockItem) {
      if (Math.abs(data.quantity) > restockItem.currentQuantity) {
        toast({ title: "Cannot deduct more than current quantity (" + restockItem.currentQuantity + ")", variant: "destructive" });
        return;
      }
    }
    if (data.quantity < 0) {
      toast({ title: "Quantity cannot be negative", variant: "destructive" });
      return;
    }
    restockMutation.mutate(data);
  };

  const handlePriceAdjust = () => {
    if (!restockItem) return;
    if (newPrice < 0) {
      toast({ title: "Price cannot be negative", variant: "destructive" });
      return;
    }
    priceAdjustMutation.mutate({ id: restockItem._id, unitPrice: newPrice });
  };

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-xl sm:text-2xl font-bold">Inventory</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-20" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-inventory-title">Inventory</h1>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-item">
          <Plus className="mr-1" /> Add Item
        </Button>
      </div>

      {isAdmin && pendingApprovals.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-600">
              <ImageIcon className="h-4 w-4" /> Image Approvals ({pendingApprovals.length} pending)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map((approval) => (
                <div key={approval._id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md" data-testid={`approval-${approval._id}`}>
                  <img
                    src={`/api/uploads/${approval.filename}`}
                    alt="Pending"
                    className="w-12 h-12 rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{approval.item?.itemName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">Uploaded by {approval.uploadedBy}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-green-600"
                      onClick={() => approveImageMutation.mutate({ id: approval._id, action: "approve" })}
                      data-testid={`button-approve-${approval._id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => approveImageMutation.mutate({ id: approval._id, action: "reject" })}
                      data-testid={`button-reject-${approval._id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="stat-total-items">{totalItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive" data-testid="stat-critical">{criticalStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600" data-testid="stat-low">{lowStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="stat-value">{formatCurrency(totalValue)}</div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-items"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => toggleView("grid")}
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => toggleView("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="grid-view">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-8">No items found</div>
          ) : (
            filtered.map((item) => (
              <Card key={item._id} className="overflow-hidden" data-testid={`card-item-${item._id}`}>
                <div className="relative">
                  <ItemImage item={item} onUpload={handleImageUpload} onDelete={(id) => deleteImageMutation.mutate(id)} isAdmin={isAdmin} />
                  <div className="absolute top-2 right-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRestockItem(item);
                        setAdjustType("restock");
                        restockForm.reset({ itemId: item._id, type: "restock", quantity: 0, reason: "" });
                      }}
                      data-testid={`button-adjust-grid-${item._id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Adjust
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="font-semibold text-sm truncate" data-testid={`text-item-name-${item._id}`}>{item.itemName}</div>
                  <div className="text-xs text-muted-foreground">{item.category}</div>
                  <div className="text-xs text-muted-foreground">{item.supplierName || "-"}</div>
                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="font-medium">{formatCurrency(item.unitPrice)}</span>
                    <span className="text-muted-foreground">Qty: {item.currentQuantity}</span>
                  </div>
                  <div className="pt-1">
                    <StockBadge item={item} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Image</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const imageUrl = (item as any).imageFilename ? `/api/uploads/${(item as any).imageFilename}` : null;
                    const isPending = (item as any).imagePending;
                    return (
                      <TableRow key={item._id} data-testid={`row-item-${item._id}`}>
                        <TableCell>
                          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center group cursor-pointer">
                            {imageUrl ? (
                              <img src={imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                            ) : (
                              <label className="cursor-pointer flex items-center justify-center w-full h-full">
                                <Upload className="h-3.5 w-3.5 text-muted-foreground/40" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(item._id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                            {isPending && !isAdmin && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Clock className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-muted-foreground">{item.supplierName || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{item.currentQuantity}</TableCell>
                        <TableCell><StockBadge item={item} /></TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRestockItem(item);
                              setAdjustType("restock");
                              restockForm.reset({ itemId: item._id, type: "restock", quantity: 0, reason: "" });
                            }}
                            data-testid={`button-restock-${item._id}`}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" /> Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Add a new item to your inventory.</DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
              <FormField control={addForm.control} name="itemName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-item-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl><Input {...field} data-testid="input-item-category" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="supplierName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl><Input {...field} data-testid="input-item-supplier" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={addForm.control} name="unitPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} data-testid="input-item-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="currentQuantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-item-quantity" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="reorderLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-item-reorder" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-item">
                {addMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                Add Item
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restockItem} onOpenChange={(open) => { if (!open) { setRestockItem(null); setAdjustType("restock"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory - {restockItem?.itemName}</DialogTitle>
            <DialogDescription>Restock, adjust inventory, or change price. Current quantity: {restockItem?.currentQuantity} | Current price: {restockItem ? formatCurrency(restockItem.unitPrice) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium leading-none">Adjustment Type</label>
              <Select value={adjustType} onValueChange={(val) => {
                setAdjustType(val);
                if (val !== "price") {
                  restockForm.setValue("type", val as "restock" | "deduction" | "adjustment");
                }
                if (val === "price" && restockItem) {
                  setNewPrice(restockItem.unitPrice);
                }
              }}>
                <SelectTrigger data-testid="select-log-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="price">Adjust Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {adjustType === "price" ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none">New Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                    data-testid="input-adjust-price"
                  />
                </div>
                <Button className="w-full" onClick={handlePriceAdjust} disabled={priceAdjustMutation.isPending} data-testid="button-submit-log">
                  {priceAdjustMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                  Update Price
                </Button>
              </div>
            ) : (
              <Form {...restockForm}>
                <form onSubmit={restockForm.handleSubmit(handleAdjustSubmit)} className="space-y-4">
                  <FormField control={restockForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-log-quantity" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={restockForm.control} name="reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl><Input {...field} data-testid="input-log-reason" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={restockMutation.isPending} data-testid="button-submit-log">
                    {restockMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                    Submit
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
