import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import {
  Plus,
  Search,
  Loader2,
  ShoppingCart,
  Trash2,
  MapPin,
} from "lucide-react";
import { createOrderSchema, type CreateOrderInput, type IOrder, type IItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Pending Payment": "bg-yellow-500 text-white border-transparent",
    "Paid": "bg-blue-500 text-white border-transparent",
    "Pending Release": "bg-orange-500 text-white border-transparent",
    "Released": "bg-indigo-500 text-white border-transparent",
    "In Transit": "bg-purple-500 text-white border-transparent",
    "Completed": "bg-green-600 text-white border-transparent",
  };
  return <Badge className={colorMap[status] || ""}>{status}</Badge>;
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<{ itemId: string; itemName: string; quantity: number; unitPrice: number }[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [showAddress, setShowAddress] = useState(false);

  const { data: ordersData, isLoading } = useQuery<{ success: boolean; data: { orders: IOrder[]; total: number; page: number; pageSize: number } }>({
    queryKey: ["/api/orders"],
  });

  const { data: allItemsData } = useQuery<{ success: boolean; data: IItem[] }>({
    queryKey: ["/api/items/all"],
  });

  const orders = ordersData?.data?.orders || [];
  const allItems = allItemsData?.data || [];

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { customerId: "", customerName: "", items: [], sourceChannel: "walk-in", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setCreateOpen(false);
      form.reset();
      setOrderItems([]);
      toast({ title: "Order created successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to create order", description: err.message, variant: "destructive" }),
  });

  const addItemToOrder = () => {
    const item = allItems.find((i) => i._id === selectedItemId);
    if (!item || itemQty < 1) return;
    if (itemQty > item.currentQuantity) {
      toast({ title: "Insufficient stock", description: `Only ${item.currentQuantity} available for ${item.itemName}`, variant: "destructive" });
      return;
    }
    const exists = orderItems.find((oi) => oi.itemId === item._id);
    if (exists) {
      setOrderItems((prev) => prev.map((oi) => oi.itemId === item._id ? { ...oi, quantity: oi.quantity + itemQty } : oi));
    } else {
      setOrderItems((prev) => [...prev, { itemId: item._id, itemName: item.itemName, quantity: itemQty, unitPrice: item.unitPrice }]);
    }
    setSelectedItemId("");
    setItemQty(1);
  };

  const removeOrderItem = (itemId: string) => {
    setOrderItems((prev) => prev.filter((oi) => oi.itemId !== itemId));
  };

  const handleCreateSubmit = (data: CreateOrderInput) => {
    if (orderItems.length === 0) {
      toast({ title: "No items added", description: "Please add at least one item to the order", variant: "destructive" });
      return;
    }
    const addr = data.address;
    const hasAddress = addr && (addr.street || addr.unitNumber || addr.city || addr.province || addr.zipCode);
    createMutation.mutate({
      ...data,
      items: orderItems,
      address: hasAddress ? addr : undefined,
    });
  };

  const filterOrders = (status?: string) => {
    let filtered = orders;
    if (status) filtered = filtered.filter((o) => o.currentStatus === status);
    if (search) {
      filtered = filtered.filter(
        (o) =>
          o.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
          o.customerName.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const OrdersTable = ({ filteredOrders }: { filteredOrders: IOrder[] }) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow
                  key={order._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/orders/${order._id}`)}
                  data-testid={`row-order-${order._id}`}
                >
                  <TableCell className="font-medium font-mono text-sm">{order.trackingNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell><StatusBadge status={order.currentStatus} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
        <h1 className="text-xl sm:text-2xl font-bold">Orders</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-orders-title">Orders</h1>
        <Button onClick={() => { setCreateOpen(true); setOrderItems([]); form.reset(); setShowAddress(false); }} data-testid="button-create-order">
          <Plus className="mr-1" /> Create Order
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-orders"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="pending-payment" data-testid="tab-pending-payment">Pending Payment</TabsTrigger>
          <TabsTrigger value="pending-release" data-testid="tab-pending-release">Pending Release</TabsTrigger>
          <TabsTrigger value="released" data-testid="tab-released">Released</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><OrdersTable filteredOrders={filterOrders()} /></TabsContent>
        <TabsContent value="pending-payment"><OrdersTable filteredOrders={filterOrders("Pending Payment")} /></TabsContent>
        <TabsContent value="pending-release"><OrdersTable filteredOrders={filterOrders("Pending Release")} /></TabsContent>
        <TabsContent value="released"><OrdersTable filteredOrders={filterOrders("Released")} /></TabsContent>
        <TabsContent value="completed"><OrdersTable filteredOrders={filterOrders("Completed")} /></TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setOrderItems([]); form.reset(); setShowAddress(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
            <DialogDescription>Fill in the details to create a new order.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Type customer name" {...field} data-testid="input-customer-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sourceChannel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Channel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-channel"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="message">Message</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Items</label>
                <div className="flex items-end gap-2 flex-wrap">
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger className="w-[200px]" data-testid="select-order-item">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {allItems.map((item) => (
                        <SelectItem key={item._id} value={item._id}>
                          {item.itemName} ({item.currentQuantity} avail)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={itemQty}
                    onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                    className="w-20"
                    data-testid="input-order-item-qty"
                  />
                  <Button type="button" variant="secondary" onClick={addItemToOrder} data-testid="button-add-order-item">
                    Add
                  </Button>
                </div>
                {orderItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((oi) => (
                        <TableRow key={oi.itemId}>
                          <TableCell>{oi.itemName}</TableCell>
                          <TableCell className="text-right">{oi.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(oi.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(oi.unitPrice * oi.quantity)}</TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeOrderItem(oi.itemId)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="font-bold text-right">Total</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(orderItems.reduce((sum, oi) => sum + oi.unitPrice * oi.quantity, 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
                {orderItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items added yet</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="toggle-address"
                    checked={showAddress}
                    onCheckedChange={(checked) => setShowAddress(!!checked)}
                    data-testid="checkbox-toggle-address"
                  />
                  <label htmlFor="toggle-address" className="flex items-center gap-1.5 text-sm font-medium leading-none cursor-pointer">
                    <MapPin className="h-4 w-4" />
                    Add Delivery Address
                  </label>
                </div>
                {showAddress && (
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="address.street" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Street name" {...field} data-testid="input-address-street" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="address.unitNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit/Building Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Unit/Building #" {...field} data-testid="input-address-unit" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="address.city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} data-testid="input-address-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="address.province" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Province</FormLabel>
                          <FormControl>
                            <Input placeholder="Province" {...field} data-testid="input-address-province" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="address.zipCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="ZIP Code" {...field} data-testid="input-address-zip" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Input {...field} data-testid="input-order-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={createMutation.isPending || orderItems.length === 0} data-testid="button-submit-order">
                {createMutation.isPending && <Loader2 className="animate-spin mr-1" />}
                <ShoppingCart className="mr-1" /> Create Order
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
