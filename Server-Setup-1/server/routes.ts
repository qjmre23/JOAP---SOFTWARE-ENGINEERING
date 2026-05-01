import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import cron from "node-cron";
import { Resend } from "resend";
import nodemailer from "nodemailer";

import { authMiddleware, adminOnly, generateToken, AuthRequest } from "./middleware/auth";
import User from "./models/User";
import UserSession from "./models/UserSession";
import Item from "./models/Item";
import Customer from "./models/Customer";
import Order from "./models/Order";
import BillingPayment from "./models/BillingPayment";
import InventoryLog from "./models/InventoryLog";
import AccountingAccount from "./models/AccountingAccount";
import GeneralLedgerEntry from "./models/GeneralLedgerEntry";
import SystemLog from "./models/SystemLog";
import Settings from "./models/Settings";
import BackupHistory from "./models/BackupHistory";
import ImageApproval from "./models/ImageApproval";

import {
  loginSchema,
  createUserSchema,
  createItemSchema,
  createCustomerSchema,
  createOrderSchema,
  logPaymentSchema,
  inventoryLogSchema,
  settingsSchema,
  ledgerEntrySchema,
} from "@shared/schema";
import InventoryBatch from "./models/InventoryBatch";
import { globalTrie } from "./trie";
import { itemIndex, orderIndex, customerIndex, trackingIndex, barcodeIndex } from "./hashIndex";
import { arimaForecast } from "./forecast";

let io: SocketIOServer;

function emitEvent(event: string, data?: any) {
  if (io) io.emit(event, data);
}

async function logAction(action: string, actor: string, target = "", metadata: Record<string, any> = {}) {
  await SystemLog.create({ action, actor, target, metadata });
}

function ok(res: Response, data: any) {
  return res.json({ success: true, data });
}

function fail(res: Response, status: number, error: string, fieldErrors?: Record<string, string>) {
  return res.status(status).json({ success: false, error, fieldErrors });
}

function indexItem(item: any) {
  const id = item._id.toString();
  const entry = { type: "item", id, label: item.itemName, sublabel: item.category || "" };
  globalTrie.insert(item.itemName, entry);
  if (item.category) globalTrie.insert(item.category, entry);
  itemIndex.set(id, entry);
  if (item.barcode) barcodeIndex.set(item.barcode, entry);
}

function indexCustomer(customer: any) {
  const id = customer._id.toString();
  const entry = { type: "customer", id, label: customer.name, sublabel: customer.phone || "" };
  globalTrie.insert(customer.name, entry);
  customerIndex.set(id, entry);
}

function indexOrder(order: any) {
  const id = order._id.toString();
  const entry = { type: "order", id, label: order.trackingNumber, sublabel: order.customerName || "" };
  globalTrie.insert(order.trackingNumber, entry);
  if (order.customerName) globalTrie.insert(order.customerName, entry);
  orderIndex.set(id, entry);
  trackingIndex.set(order.trackingNumber, entry);
}

async function buildSearchIndexes() {
  globalTrie.clear();
  itemIndex.clear();
  barcodeIndex.clear();
  customerIndex.clear();
  orderIndex.clear();
  trackingIndex.clear();

  const [items, customers, orders] = await Promise.all([
    Item.find().lean(),
    Customer.find().lean(),
    Order.find().lean(),
  ]);

  for (const item of items) indexItem(item);
  for (const customer of customers) indexCustomer(customer);
  for (const order of orders) indexOrder(order);

  console.log(`${new Date().toLocaleTimeString()} [search] Trie & hash indexes built: ${items.length} items, ${customers.length} customers, ${orders.length} orders`);
}

async function ensureInventoryBatches() {
  const items = await Item.find({ currentQuantity: { $gt: 0 } }).lean();
  if (items.length === 0) return;

  let created = 0;
  for (const item of items) {
    const existing = await InventoryBatch.countDocuments({ itemId: item._id });
    if (existing === 0) {
      await InventoryBatch.create({
        itemId: item._id,
        quantity: item.currentQuantity,
        remainingQuantity: item.currentQuantity,
        unitCost: item.unitPrice,
        source: "initial",
      });
      created++;
    }
  }
  if (created > 0) {
    console.log(`${new Date().toLocaleTimeString()} [fifo] Created ${created} initial inventory batches`);
  }
}

async function deductFIFO(itemId: string, quantity: number): Promise<{ totalCost: number; batchesUsed: Array<{ batchId: string; qty: number; cost: number }>; shortfall: number }> {
  const batches = await InventoryBatch.find({ itemId, remainingQuantity: { $gt: 0 } }).sort({ createdAt: 1 });
  const totalAvailable = batches.reduce((s, b) => s + b.remainingQuantity, 0);

  let remaining = quantity;
  let totalCost = 0;
  const batchesUsed: Array<{ batchId: string; qty: number; cost: number }> = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(remaining, batch.remainingQuantity);
    batch.remainingQuantity -= deduct;
    await batch.save();
    totalCost += deduct * batch.unitCost;
    batchesUsed.push({ batchId: batch._id.toString(), qty: deduct, cost: batch.unitCost });
    remaining -= deduct;
  }

  return { totalCost, batchesUsed, shortfall: remaining };
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const BACKUPS_DIR = path.join(process.cwd(), "backups");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `item-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

async function createBackupData() {
  const [items, customers, orders, payments, inventoryLogs, accounts, ledger, settings, systemLogs, users] =
    await Promise.all([
      Item.find().lean(),
      Customer.find().lean(),
      Order.find().lean(),
      BillingPayment.find().lean(),
      InventoryLog.find().lean(),
      AccountingAccount.find().lean(),
      GeneralLedgerEntry.find().lean(),
      Settings.find().lean(),
      SystemLog.find().lean(),
      User.find().select("-password").lean(),
    ]);
  return { items, customers, orders, payments, inventoryLogs, accounts, ledger, settings, systemLogs, users, exportDate: new Date() };
}

async function performAutoBackup() {
  try {
    const data = await createBackupData();
    const json = JSON.stringify(data, null, 2);
    const filename = `auto-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(path.join(BACKUPS_DIR, filename), json);
    await BackupHistory.create({ filename, size: Buffer.byteLength(json), source: "auto", createdBy: "system" });
    console.log(`[auto-backup] Created ${filename}`);
  } catch (err) {
    console.error("[auto-backup] Failed:", err);
  }
}

let autoBackupJob: cron.ScheduledTask | null = null;

function setupAutoBackupScheduler(intervalValue: number, intervalUnit: string, enabled: boolean) {
  if (autoBackupJob) { autoBackupJob.stop(); autoBackupJob = null; }
  if (!enabled) return;

  let cronExpr: string;
  if (intervalUnit === "hours") {
    cronExpr = `0 */${Math.max(1, intervalValue)} * * *`;
  } else if (intervalUnit === "days") {
    cronExpr = `0 0 */${Math.max(1, intervalValue)} * *`;
  } else {
    cronExpr = `0 0 * * ${Math.max(1, intervalValue) === 1 ? "0" : `0/${Math.max(1, intervalValue)}`}`;
  }

  try {
    autoBackupJob = cron.schedule(cronExpr, performAutoBackup);
    console.log(`[auto-backup] Scheduled: every ${intervalValue} ${intervalUnit} (${cronExpr})`);
  } catch {
    cronExpr = "0 */24 * * *";
    autoBackupJob = cron.schedule(cronExpr, performAutoBackup);
  }
}

async function initAutoBackup() {
  const settings = await Settings.findOne();
  if (settings?.autoBackupEnabled) {
    setupAutoBackupScheduler(settings.autoBackupIntervalValue, settings.autoBackupIntervalUnit, true);
  }
}
setTimeout(initAutoBackup, 3000);

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(cookieParser());

  io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

  buildSearchIndexes().catch(err => console.error("Failed to build search indexes:", err));
  ensureInventoryBatches().catch(err => console.error("Failed to ensure inventory batches:", err));

  // ─── AUTH ───────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed");

      const { username, password } = parsed.data;
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) return fail(res, 401, "Invalid credentials");
      if (!user.isActive) return fail(res, 403, "Account is inactive");

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return fail(res, 401, "Invalid credentials");

      const activeSessions = await UserSession.find({
        userId: user._id,
        isActive: true,
        lastActivity: { $gte: new Date(Date.now() - 300000) },
      });

      const hadActiveSessions = activeSessions.length > 0;
      await UserSession.updateMany({ userId: user._id, isActive: true }, { isActive: false });

      const token = generateToken({ _id: user._id.toString(), username: user.username, role: user.role });
      await UserSession.create({ userId: user._id, token, isActive: true });

      await logAction("USER_LOGIN", user.username, user.username, hadActiveSessions ? { previousSessionTerminated: true } : {});

      res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 86400000 });
      return ok(res, {
        token,
        user: { _id: user._id, username: user.username, role: user.role, isActive: user.isActive },
        previousSessionTerminated: hadActiveSessions,
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const token = req.headers.authorization?.slice(7) || req.cookies?.token;
      if (token) await UserSession.updateOne({ token }, { isActive: false });
      await logAction("USER_LOGOUT", req.user!.username);
      res.clearCookie("token");
      return ok(res, { message: "Logged out" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findById(req.user!._id).select("-password");
      if (!user) return fail(res, 404, "User not found");
      return ok(res, { user });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── FORGOT PASSWORD (Nodemailer Gmail) ─────────────────────
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) return fail(res, 400, "Username is required");

      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) return fail(res, 404, "User not found");
      if (!user.isActive) return fail(res, 403, "Account is inactive");

      if (user.role === "EMPLOYEE") {
        return fail(res, 403, "Please contact your admin");
      }

      if (!user.email) {
        return fail(res, 400, "No email address on file. Please contact system administrator.");
      }

      const token = crypto.randomBytes(32).toString("hex");
      user.resetToken = token;
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const host = req.get("host") || process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
      const resetUrl = `https://${host}/reset-password?token=${token}`;

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: "JOAP Hardware Trading - Password Reset",
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
          <h2 style="color:#1e40af;">Password Reset Request</h2>
          <p>Hi <strong>${user.username}</strong>,</p>
          <p>You requested a password reset for your JOAP Hardware Trading account.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p>
          <p style="color:#6b7280;font-size:14px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="color:#9ca3af;font-size:12px;">JOAP Hardware Trading Management System</p>
        </div>`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("[nodemailer] Email sent:", info.messageId);

      await logAction("PASSWORD_RESET_REQUESTED", user.username, user.username);
      return ok(res, { message: "Password reset email sent to " + user.email });
    } catch (err: any) {
      console.error("[nodemailer] Exception:", err);
      return fail(res, 500, "Failed to send reset email: " + err.message);
    }
  });

  app.get("/api/auth/verify-reset-token", async (req: Request, res: Response) => {
    try {
      const { token } = req.query as Record<string, string>;
      if (!token) return fail(res, 400, "Token is required");

      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });

      if (!user) {
        const anyUser = await User.findOne({ resetToken: token });
        if (anyUser) {
          return fail(res, 400, "This reset token has expired. Please request a new password reset.");
        }
        return fail(res, 400, "Invalid reset token. If you requested multiple resets, please use the link from the most recent email.");
      }
      return ok(res, { valid: true, username: user.username });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return fail(res, 400, "Token and new password are required");
      if (newPassword.length < 6) return fail(res, 400, "Password must be at least 6 characters");

      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
      });

      if (!user) return fail(res, 400, "Invalid or expired reset token");

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();

      await logAction("PASSWORD_RESET_COMPLETED", user.username, user.username);
      return ok(res, { message: "Password has been reset successfully" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── PROFILE EMAIL UPDATE ─────────────────────────────────
  app.patch("/api/auth/profile/email", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail(res, 400, "Valid email address is required");
      }

      const user = await User.findById(req.user!._id);
      if (!user) return fail(res, 404, "User not found");

      user.email = email;
      await user.save();

      await logAction("EMAIL_UPDATED", req.user!.username, req.user!.username, { email });
      return ok(res, { message: "Email updated successfully", email });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/auth/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findById(req.user!._id).select("-password");
      if (!user) return fail(res, 404, "User not found");
      return ok(res, { user });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── DASHBOARD ──────────────────────────────────────────
  app.get("/api/dashboard/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        totalOrdersToday,
        completedOrders,
        pendingPayments,
        pendingReleases,
        todayPayments,
        allPayments,
        activeUsers,
        totalItems,
        items,
      ] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: todayStart } }),
        Order.countDocuments({ currentStatus: "Completed" }),
        Order.countDocuments({ currentStatus: "Pending Payment" }),
        Order.countDocuments({ currentStatus: { $in: ["Paid", "Pending Release"] } }),
        BillingPayment.aggregate([
          { $match: { paymentDate: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: "$amountPaid" } } },
        ]),
        BillingPayment.aggregate([{ $group: { _id: null, total: { $sum: "$amountPaid" } } }]),
        UserSession.countDocuments({ isActive: true, lastActivity: { $gte: new Date(Date.now() - 3600000) } }),
        Item.countDocuments(),
        Item.find().lean(),
      ]);

      const settings = await Settings.findOne();
      const reorderThreshold = settings?.reorderThreshold ?? 10;
      const lowStockThreshold = settings?.lowStockThreshold ?? 20;

      const criticalStock = items.filter((i) => i.currentQuantity <= reorderThreshold).length;
      const lowStock = items.filter((i) => i.currentQuantity > reorderThreshold && i.currentQuantity <= lowStockThreshold).length;
      const totalInventoryValue = items.reduce((sum, i) => sum + i.unitPrice * i.currentQuantity, 0);

      return ok(res, {
        totalOrdersToday,
        completedOrders,
        pendingPayments,
        pendingReleases,
        todayRevenue: todayPayments[0]?.total || 0,
        totalRevenue: allPayments[0]?.total || 0,
        activeUsers,
        totalItems,
        criticalStock,
        lowStock,
        totalInventoryValue,
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/dashboard/revenue-chart", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const data = await BillingPayment.aggregate([
        { $match: { paymentDate: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
            revenue: { $sum: "$amountPaid" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return ok(res, data.map((d) => ({ date: d._id, revenue: d.revenue })));
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/dashboard/orders-by-status", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const data = await Order.aggregate([
        { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      return ok(res, data.map((d) => ({ status: d._id, count: d.count })));
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/dashboard/inventory-status", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const settings = await Settings.findOne();
      const reorderThreshold = settings?.reorderThreshold ?? 10;
      const lowThreshold = settings?.lowStockThreshold ?? 20;
      const items = await Item.find().lean();
      const critical = items.filter((i) => i.currentQuantity <= reorderThreshold).length;
      const low = items.filter((i) => i.currentQuantity > reorderThreshold && i.currentQuantity <= lowThreshold).length;
      const normal = items.filter((i) => i.currentQuantity > lowThreshold).length;
      return ok(res, [
        { name: "Critical", value: critical },
        { name: "Low", value: low },
        { name: "Normal", value: normal },
      ]);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ADVANCED DASHBOARD ─────────────────────────────────
  app.get("/api/dashboard/advanced", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { period = "monthly" } = req.query as Record<string, string>;
      const now = new Date();

      function getPeriodRange(p: string): { start: Date; prevStart: Date; groupFormat: string; labels: string[] } {
        const s = new Date(now);
        const ps = new Date(now);
        if (p === "daily") {
          s.setHours(0, 0, 0, 0);
          ps.setDate(ps.getDate() - 1); ps.setHours(0, 0, 0, 0);
          return { start: s, prevStart: ps, groupFormat: "%H", labels: Array.from({ length: 24 }, (_, i) => `${i}:00`) };
        } else if (p === "weekly") {
          const day = s.getDay();
          s.setDate(s.getDate() - day); s.setHours(0, 0, 0, 0);
          ps.setDate(ps.getDate() - day - 7); ps.setHours(0, 0, 0, 0);
          return { start: s, prevStart: ps, groupFormat: "%w", labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
        } else if (p === "monthly") {
          s.setDate(1); s.setHours(0, 0, 0, 0);
          ps.setMonth(ps.getMonth() - 1); ps.setDate(1); ps.setHours(0, 0, 0, 0);
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          return { start: s, prevStart: ps, groupFormat: "%d", labels: Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`) };
        } else {
          s.setMonth(0, 1); s.setHours(0, 0, 0, 0);
          ps.setFullYear(ps.getFullYear() - 1); ps.setMonth(0, 1); ps.setHours(0, 0, 0, 0);
          return { start: s, prevStart: ps, groupFormat: "%m", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
        }
      }

      const range = getPeriodRange(period);

      const [
        currentPayments,
        prevPayments,
        currentOrders,
        prevOrders,
        allOrders,
        allItems,
        pendingOrders,
        revenueByPeriod,
        ordersByPeriod,
        ordersByChannel,
        topItems,
      ] = await Promise.all([
        BillingPayment.aggregate([
          { $match: { paymentDate: { $gte: range.start } } },
          { $group: { _id: null, total: { $sum: "$amountPaid" }, count: { $sum: 1 } } },
        ]),
        BillingPayment.aggregate([
          { $match: { paymentDate: { $gte: range.prevStart, $lt: range.start } } },
          { $group: { _id: null, total: { $sum: "$amountPaid" }, count: { $sum: 1 } } },
        ]),
        Order.countDocuments({ createdAt: { $gte: range.start } }),
        Order.countDocuments({ createdAt: { $gte: range.prevStart, $lt: range.start } }),
        Order.find({ createdAt: { $gte: range.start } }).lean(),
        Item.find().lean(),
        Order.find({ currentStatus: "Pending Payment" }).lean(),
        BillingPayment.aggregate([
          { $match: { paymentDate: { $gte: range.start } } },
          { $group: { _id: { $dateToString: { format: range.groupFormat, date: "$paymentDate", timezone: "+08:00" } }, revenue: { $sum: "$amountPaid" } } },
          { $sort: { _id: 1 } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: range.start } } },
          { $group: { _id: { $dateToString: { format: range.groupFormat, date: "$createdAt", timezone: "+08:00" } }, orders: { $sum: 1 }, orderValue: { $sum: "$totalAmount" } } },
          { $sort: { _id: 1 } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: range.start } } },
          { $group: { _id: "$sourceChannel", count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: range.start } } },
          { $unwind: "$items" },
          { $group: { _id: { itemId: "$items.itemId", itemName: "$items.itemName" }, totalQty: { $sum: "$items.quantity" }, totalRevenue: { $sum: "$items.lineTotal" }, unitPrice: { $first: "$items.unitPrice" } } },
          { $sort: { totalQty: -1 } },
          { $limit: 5 },
        ]),
      ]);

      const curRevenue = currentPayments[0]?.total || 0;
      const prevRevenue = prevPayments[0]?.total || 0;
      const revenueTrend = prevRevenue > 0 ? ((curRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : "0.0";

      const ordersTrend = prevOrders > 0 ? ((currentOrders - prevOrders) / prevOrders * 100).toFixed(1) : "0.0";

      const uniqueCustomers = new Set(allOrders.map((o: any) => o.customerName?.toLowerCase())).size;
      const prevCustomers = await Order.aggregate([
        { $match: { createdAt: { $gte: range.prevStart, $lt: range.start } } },
        { $group: { _id: { $toLower: "$customerName" } } },
      ]);
      const customersTrend = prevCustomers.length > 0 ? ((uniqueCustomers - prevCustomers.length) / prevCustomers.length * 100).toFixed(1) : "0.0";

      const customersByPeriod = await Order.aggregate([
        { $match: { createdAt: { $gte: range.start } } },
        { $group: { _id: { period: { $dateToString: { format: range.groupFormat, date: "$createdAt", timezone: "+08:00" } }, customer: { $toLower: "$customerName" } } } },
        { $group: { _id: "$_id.period", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      const custMap: Record<string, number> = {};
      customersByPeriod.forEach((c: any) => { custMap[c._id] = c.count; });

      const totalInventoryValue = allItems.reduce((sum: number, i: any) => sum + i.unitPrice * i.currentQuantity, 0);
      const pendingBalance = pendingOrders.reduce((sum: number, o: any) => sum + o.totalAmount, 0);

      const revMap: Record<string, number> = {};
      revenueByPeriod.forEach((r: any) => { revMap[r._id] = r.revenue; });
      const ordMap: Record<string, { orders: number; orderValue: number }> = {};
      ordersByPeriod.forEach((o: any) => { ordMap[o._id] = { orders: o.orders, orderValue: o.orderValue }; });

      function periodKey(i: number): string {
        if (period === "daily") return String(i).padStart(2, "0");
        if (period === "weekly") return String(i);
        if (period === "monthly") return String(i + 1).padStart(2, "0");
        return String(i + 1).padStart(2, "0");
      }

      const sparklineRevenue = range.labels.map((_, i) => revMap[periodKey(i)] || 0);
      const sparklineOrders = range.labels.map((_, i) => ordMap[periodKey(i)]?.orders || 0);
      const sparklineCustomers = range.labels.map((_, i) => custMap[periodKey(i)] || 0);

      const revenueChartData = range.labels.map((label, i) => {
        const key = periodKey(i);
        return { label, revenue: revMap[key] || 0, orders: ordMap[key]?.orderValue || 0 };
      });

      const channelMap: Record<string, number> = {};
      ordersByChannel.forEach((c: any) => { channelMap[c._id || "walk-in"] = c.count; });

      return ok(res, {
        earnings: { total: curRevenue, trend: parseFloat(revenueTrend as string), sparkline: sparklineRevenue },
        orders: { total: currentOrders, trend: parseFloat(ordersTrend as string), sparkline: sparklineOrders },
        customers: { total: uniqueCustomers, trend: parseFloat(customersTrend as string), sparkline: sparklineCustomers },
        balance: { total: pendingBalance, inventoryValue: totalInventoryValue },
        revenueChart: revenueChartData,
        channelBreakdown: {
          "walk-in": channelMap["walk-in"] || 0,
          phone: channelMap["phone"] || 0,
          email: channelMap["email"] || 0,
          message: channelMap["message"] || 0,
        },
        topItems: topItems.map((t: any) => ({
          itemName: t._id.itemName,
          unitPrice: t.unitPrice,
          totalQty: t.totalQty,
          totalRevenue: t.totalRevenue,
        })),
        labels: range.labels,
        totalRevenue: curRevenue,
        totalOrderValue: allOrders.reduce((s: number, o: any) => s + o.totalAmount, 0),
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── DATE DETAIL FOR CALENDAR ──────────────────────────
  app.get("/api/dashboard/date-detail", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { date, tz } = req.query as Record<string, string>;
      if (!date) return fail(res, 400, "Date parameter required (YYYY-MM-DD)");

      const tzOffset = tz ? parseInt(tz) : 480;
      const dayStart = new Date(new Date(date + "T00:00:00.000Z").getTime() - tzOffset * 60000);
      const dayEnd = new Date(new Date(date + "T23:59:59.999Z").getTime() - tzOffset * 60000);

      if (isNaN(dayStart.getTime())) return fail(res, 400, "Invalid date format");

      const [orders, payments, inventoryLogs, systemLogs] = await Promise.all([
        Order.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).lean(),
        BillingPayment.find({ paymentDate: { $gte: dayStart, $lte: dayEnd } }).lean(),
        InventoryLog.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).lean(),
        SystemLog.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).sort({ createdAt: -1 }).limit(50).lean(),
      ]);

      const totalSales = payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalOrderValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const uniqueCustomers = [...new Set(orders.map((o) => o.customerName?.toLowerCase()).filter(Boolean))];

      const channelBreakdown: Record<string, number> = {};
      orders.forEach((o) => {
        const ch = o.sourceChannel || "walk-in";
        channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1;
      });

      const itemsSold: Record<string, { itemName: string; quantity: number; revenue: number }> = {};
      orders.forEach((o) => {
        (o.items || []).forEach((item: any) => {
          const key = item.itemName || item.itemId?.toString() || "unknown";
          if (!itemsSold[key]) itemsSold[key] = { itemName: key, quantity: 0, revenue: 0 };
          itemsSold[key].quantity += item.quantity;
          itemsSold[key].revenue += item.lineTotal || 0;
        });
      });

      const topItemsSold = Object.values(itemsSold).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      const paymentMethods: Record<string, { count: number; total: number }> = {};
      payments.forEach((p) => {
        const method = p.paymentMethod || "Cash";
        if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
        paymentMethods[method].count += 1;
        paymentMethods[method].total += p.amountPaid;
      });

      const orderStatuses: Record<string, number> = {};
      orders.forEach((o) => {
        const st = o.currentStatus || "Unknown";
        orderStatuses[st] = (orderStatuses[st] || 0) + 1;
      });

      const hourlyRevenue = Array.from({ length: 24 }, (_, h) => {
        const hourPayments = payments.filter((p) => new Date(p.paymentDate).getUTCHours() === h);
        return { hour: `${h}:00`, revenue: hourPayments.reduce((s, p) => s + p.amountPaid, 0) };
      });

      const hasActivity = orders.length > 0 || payments.length > 0 || inventoryLogs.length > 0;

      return ok(res, {
        date,
        hasActivity,
        summary: {
          totalSales,
          totalOrderValue,
          orderCount: orders.length,
          paymentCount: payments.length,
          customerCount: uniqueCustomers.length,
          inventoryChanges: inventoryLogs.length,
        },
        customers: uniqueCustomers,
        orders: orders.map((o) => ({
          _id: o._id,
          trackingNumber: o.trackingNumber,
          customerName: o.customerName,
          totalAmount: o.totalAmount,
          currentStatus: o.currentStatus,
          sourceChannel: o.sourceChannel,
          itemCount: o.items?.length || 0,
          createdAt: o.createdAt,
        })),
        payments: payments.map((p) => ({
          _id: p._id,
          orderId: p.orderId,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          gcashNumber: p.gcashNumber,
          gcashReferenceNumber: p.gcashReferenceNumber,
          loggedBy: p.loggedBy,
          paymentDate: p.paymentDate,
        })),
        channelBreakdown,
        topItemsSold,
        paymentMethods,
        orderStatuses,
        hourlyRevenue,
        inventoryLogs: inventoryLogs.map((l) => ({
          _id: l._id,
          itemName: l.itemName,
          type: l.type,
          quantity: l.quantity,
          reason: l.reason,
          actor: l.actor,
          createdAt: l.createdAt,
        })),
        recentActivity: systemLogs.map((l) => ({
          _id: l._id,
          action: l.action,
          actor: l.actor,
          target: l.target,
          createdAt: l.createdAt,
        })),
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/dashboard/calendar-heatmap", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { year, month } = req.query as Record<string, string>;
      if (!year || !month) return fail(res, 400, "year and month parameters required");

      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));

      const [orderCounts, paymentTotals] = await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
        ]),
        BillingPayment.aggregate([
          { $match: { paymentDate: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } }, count: { $sum: 1 }, total: { $sum: "$amountPaid" } } },
        ]),
      ]);

      const heatmap: Record<string, { orders: number; orderValue: number; payments: number; revenue: number }> = {};
      orderCounts.forEach((o: any) => {
        if (!heatmap[o._id]) heatmap[o._id] = { orders: 0, orderValue: 0, payments: 0, revenue: 0 };
        heatmap[o._id].orders = o.count;
        heatmap[o._id].orderValue = o.total;
      });
      paymentTotals.forEach((p: any) => {
        if (!heatmap[p._id]) heatmap[p._id] = { orders: 0, orderValue: 0, payments: 0, revenue: 0 };
        heatmap[p._id].payments = p.count;
        heatmap[p._id].revenue = p.total;
      });

      return ok(res, { year: parseInt(year), month: parseInt(month), heatmap });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ADMIN USERS ────────────────────────────────────────
  app.get("/api/admin/users", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { search, role, status, page = "1", pageSize = "10" } = req.query as Record<string, string>;
      const filter: any = {};
      if (search) filter.username = { $regex: search, $options: "i" };
      if (role) filter.role = role;
      if (status === "active") filter.isActive = true;
      if (status === "inactive") filter.isActive = false;

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [users, total] = await Promise.all([
        User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
        User.countDocuments(filter),
      ]);

      const userIds = users.map((u) => u._id);
      const lastSessions = await UserSession.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $sort: { lastActivity: -1 } },
        { $group: { _id: "$userId", lastLogin: { $first: "$lastActivity" } } },
      ]);
      const sessionMap = new Map(lastSessions.map((s) => [s._id.toString(), s.lastLogin]));

      const usersWithLogin = users.map((u) => ({
        ...u.toObject(),
        lastLogin: sessionMap.get(u._id.toString()) || null,
      }));

      return ok(res, { users: usersWithLogin, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/admin/users", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed", Object.fromEntries(parsed.error.errors.map((e) => [e.path.join("."), e.message])));

      const existing = await User.findOne({ username: parsed.data.username.toLowerCase() });
      if (existing) return fail(res, 409, "Username already exists");

      const hashed = await bcrypt.hash(parsed.data.password, 10);
      const user = await User.create({ ...parsed.data, username: parsed.data.username.toLowerCase(), password: hashed });
      await logAction("USER_CREATED", req.user!.username, user.username, { role: user.role });
      emitEvent("USER_CREATED");
      return ok(res, { _id: user._id, username: user.username, role: user.role, isActive: user.isActive });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/admin/users/:id/status", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select("-password");
      if (!user) return fail(res, 404, "User not found");
      if (!req.body.isActive) await UserSession.updateMany({ userId: user._id }, { isActive: false });
      await logAction("USER_STATUS_CHANGED", req.user!.username, user.username, { isActive: user.isActive });
      return ok(res, user);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/admin/users/:id/role", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select("-password");
      if (!user) return fail(res, 404, "User not found");
      await logAction("USER_ROLE_CHANGED", req.user!.username, user.username, { role: user.role });
      return ok(res, user);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/admin/users/:id/reset-password", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const tempPass = Math.random().toString(36).slice(-8);
      const hashed = await bcrypt.hash(tempPass, 10);
      const user = await User.findByIdAndUpdate(req.params.id, { password: hashed }).select("-password");
      if (!user) return fail(res, 404, "User not found");
      await logAction("USER_PASSWORD_RESET", req.user!.username, user.username);
      return ok(res, { temporaryPassword: tempPass });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ITEMS ───────────────────────────────────
  app.get("/api/items", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { search, category, page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const filter: any = {};
      if (search) filter.$or = [{ itemName: { $regex: search, $options: "i" } }, { barcode: { $regex: search, $options: "i" } }];
      if (category) filter.category = category;

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [items, total] = await Promise.all([
        Item.find(filter).sort({ itemName: 1 }).skip(skip).limit(parseInt(pageSize)),
        Item.countDocuments(filter),
      ]);
      return ok(res, { items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/items/all", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const items = await Item.find().sort({ itemName: 1 }).lean();
      return ok(res, items);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/items/categories", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const categories = await Item.distinct("category");
      return ok(res, categories);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/items", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createItemSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed", Object.fromEntries(parsed.error.errors.map((e) => [e.path.join("."), e.message])));

      const item = await Item.create(parsed.data);

      if (item.currentQuantity > 0) {
        await InventoryLog.create({
          itemId: item._id,
          itemName: item.itemName,
          type: "restock",
          quantity: item.currentQuantity,
          reason: "Initial stock",
          actor: req.user!.username,
        });
      }

      if (item.currentQuantity > 0) {
        await InventoryBatch.create({
          itemId: item._id,
          quantity: item.currentQuantity,
          remainingQuantity: item.currentQuantity,
          unitCost: item.unitPrice,
          source: "initial",
        });
      }

      indexItem(item);
      await logAction("ITEM_CREATED", req.user!.username, item.itemName);
      emitEvent("INVENTORY_LOG_CREATED");
      return ok(res, item);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/items/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { unitPrice } = req.body;
      if (unitPrice !== undefined && unitPrice < 0) return fail(res, 400, "Price cannot be negative");
      const item = await Item.findByIdAndUpdate(req.params.id, { unitPrice }, { new: true });
      if (!item) return fail(res, 404, "Item not found");
      indexItem(item);
      await logAction("ITEM_PRICE_ADJUSTED", req.user!.username, item.itemName, { unitPrice });
      emitEvent("INVENTORY_LOG_CREATED");
      return ok(res, item);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── INVENTORY LOGS ─────────────────────────────────────
  app.get("/api/inventory-logs", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { itemId, page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const filter: any = {};
      if (itemId) filter.itemId = itemId;

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [logs, total] = await Promise.all([
        InventoryLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
        InventoryLog.countDocuments(filter),
      ]);
      return ok(res, { logs, total });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/inventory-logs", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = inventoryLogSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed");

      const item = await Item.findById(parsed.data.itemId);
      if (!item) return fail(res, 404, "Item not found");

      const quantityChange = parsed.data.type === "deduction" ? -Math.abs(parsed.data.quantity) : parsed.data.quantity;

      if (item.currentQuantity + quantityChange < 0) {
        return fail(res, 400, `Insufficient stock. Current: ${item.currentQuantity}`);
      }

      item.currentQuantity += quantityChange;
      await item.save();

      if (parsed.data.type === "restock") {
        await InventoryBatch.create({
          itemId: item._id,
          quantity: Math.abs(parsed.data.quantity),
          remainingQuantity: Math.abs(parsed.data.quantity),
          unitCost: item.unitPrice,
          source: "restock",
        });
      } else if (parsed.data.type === "deduction") {
        await deductFIFO(item._id.toString(), Math.abs(parsed.data.quantity));
      }

      const logEntry = await InventoryLog.create({
        ...parsed.data,
        quantity: quantityChange,
        itemName: item.itemName,
        actor: req.user!.username,
      });

      await logAction("INVENTORY_LOG_CREATED", req.user!.username, item.itemName, { type: parsed.data.type, quantity: quantityChange });
      emitEvent("INVENTORY_LOG_CREATED", { itemId: item._id });
      return ok(res, logEntry);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── CUSTOMERS ──────────────────────────────────────────
  app.get("/api/customers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { search } = req.query as Record<string, string>;
      const filter: any = {};
      if (search) filter.name = { $regex: search, $options: "i" };
      const customers = await Customer.find(filter).sort({ name: 1 });
      return ok(res, customers);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/customers", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed");
      const customer = await Customer.create(parsed.data);
      indexCustomer(customer);
      return ok(res, customer);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ORDERS ─────────────────────────────────────────────
  app.get("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { status, search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const filter: any = {};
      if (status) filter.currentStatus = status;
      if (search) filter.$or = [
        { trackingNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
        Order.countDocuments(filter),
      ]);
      return ok(res, { orders, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/orders/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return fail(res, 404, "Order not found");
      const payments = await BillingPayment.find({ orderId: order._id }).sort({ createdAt: -1 });
      return ok(res, { order, payments });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed", Object.fromEntries(parsed.error.errors.map((e) => [e.path.join("."), e.message])));
      if (!parsed.data.items || parsed.data.items.length === 0) return fail(res, 400, "At least one item is required");

      const items = parsed.data.items.map((i) => ({
        ...i,
        lineTotal: i.quantity * i.unitPrice,
      }));
      const totalAmount = items.reduce((sum, i) => sum + i.lineTotal, 0);
      const trackingNumber = `JOAP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const addressData = parsed.data.address;
      const hasAddress = addressData && Object.values(addressData).some((v) => v && v.trim() !== "");

      const order = await Order.create({
        trackingNumber,
        ...(parsed.data.customerId ? { customerId: parsed.data.customerId } : {}),
        customerName: parsed.data.customerName,
        items,
        totalAmount,
        sourceChannel: parsed.data.sourceChannel,
        notes: parsed.data.notes,
        currentStatus: "Pending Payment",
        statusHistory: [{ status: "Pending Payment", timestamp: new Date(), actor: req.user!.username, note: "Order created" }],
        ...(hasAddress ? { address: addressData } : {}),
      });

      indexOrder(order);
      await logAction("ORDER_CREATED", req.user!.username, order.trackingNumber, { totalAmount });
      emitEvent("ORDER_CREATED", { orderId: order._id });
      return ok(res, order);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── BILLING & PAYMENT ─────────────────────────────────
  app.get("/api/billing", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [payments, total] = await Promise.all([
        BillingPayment.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
        BillingPayment.countDocuments(),
      ]);
      return ok(res, { payments, total });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/billing/pay", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = logPaymentSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed", Object.fromEntries(parsed.error.errors.map((e) => [e.path.join("."), e.message])));

      const order = await Order.findById(parsed.data.orderId);
      if (!order) return fail(res, 404, "Order not found");
      if (!["Pending Payment"].includes(order.currentStatus)) return fail(res, 400, "Order is not pending payment");

      const existingRef = await BillingPayment.findOne({ gcashReferenceNumber: parsed.data.gcashReferenceNumber });
      if (existingRef) return fail(res, 409, "Duplicate GCash reference number");

      const remainingAmount = order.totalAmount - (order.amountPaid || 0);
      if (parsed.data.amountPaid > remainingAmount) {
        return fail(res, 400, `Payment exceeds remaining balance of ${remainingAmount.toFixed(2)}`);
      }

      const payment = await BillingPayment.create({
        ...parsed.data,
        paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date(),
        loggedBy: req.user!.username,
      });

      order.amountPaid = (order.amountPaid || 0) + parsed.data.amountPaid;
      const fullyPaid = order.amountPaid >= order.totalAmount;

      order.statusHistory.push(
        { status: "Paid", timestamp: new Date(), actor: req.user!.username, note: `Payment of ${parsed.data.amountPaid} received via ${parsed.data.paymentMethod} (${fullyPaid ? "Full" : "Partial"} - Total paid: ${order.amountPaid})` }
      );

      if (fullyPaid) {
        order.currentStatus = "Pending Release";
        order.statusHistory.push(
          { status: "Pending Release", timestamp: new Date(), actor: req.user!.username, note: "Full payment confirmed, awaiting release" }
        );
      }

      await order.save();

      await GeneralLedgerEntry.create([
        { date: new Date(), accountName: "Cash/GCash", debit: parsed.data.amountPaid, credit: 0, description: `${fullyPaid ? "Full" : "Partial"} payment for order ${order.trackingNumber}`, referenceType: "payment", referenceId: payment._id.toString(), actor: req.user!.username },
        { date: new Date(), accountName: "Sales Revenue", debit: 0, credit: parsed.data.amountPaid, description: `Revenue from order ${order.trackingNumber}`, referenceType: "payment", referenceId: payment._id.toString(), actor: req.user!.username },
      ]);

      await logAction("PAYMENT_LOGGED", req.user!.username, order.trackingNumber, { amount: parsed.data.amountPaid, totalPaid: order.amountPaid, fullyPaid });
      emitEvent("PAYMENT_LOGGED", { orderId: order._id });
      emitEvent("ORDER_PAID", { orderId: order._id, fullyPaid });
      if (fullyPaid) {
        emitEvent("ORDER_STATUS_APPENDED", { orderId: order._id, status: "Pending Release" });
      }
      emitEvent("LEDGER_POSTED");
      return ok(res, { payment, order });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/billing/order/:orderId", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const payments = await BillingPayment.find({ orderId: req.params.orderId }).sort({ createdAt: -1 });
      return ok(res, payments);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ORDER RELEASE ──────────────────────────────────────
  app.post("/api/orders/:id/release", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return fail(res, 404, "Order not found");
      if (!["Paid", "Pending Release"].includes(order.currentStatus)) {
        return fail(res, 400, "Order must be Paid or Pending Release to release items");
      }

      const insufficientItems: string[] = [];
      for (const oi of order.items) {
        const item = await Item.findById(oi.itemId);
        if (!item || item.currentQuantity < oi.quantity) {
          insufficientItems.push(`${oi.itemName}: need ${oi.quantity}, have ${item?.currentQuantity ?? 0}`);
        }
      }
      if (insufficientItems.length > 0) {
        return fail(res, 400, `Insufficient stock: ${insufficientItems.join("; ")}`);
      }

      let totalCOGS = 0;
      for (const oi of order.items) {
        const item = await Item.findById(oi.itemId);
        if (item) {
          item.currentQuantity -= oi.quantity;
          await item.save();

          const fifoResult = await deductFIFO(item._id.toString(), oi.quantity);
          totalCOGS += fifoResult.totalCost;

          await InventoryLog.create({
            itemId: item._id,
            itemName: item.itemName,
            type: "deduction",
            quantity: -oi.quantity,
            reason: `Released for order ${order.trackingNumber} (FIFO COGS: ${fifoResult.totalCost.toFixed(2)})`,
            actor: req.user!.username,
          });
        }
      }

      if (totalCOGS > 0) {
        await GeneralLedgerEntry.create([
          { date: new Date(), accountName: "Cost of Goods Sold", debit: totalCOGS, credit: 0, description: `COGS for order ${order.trackingNumber} (FIFO)`, referenceType: "order", referenceId: order._id.toString(), actor: req.user!.username },
          { date: new Date(), accountName: "Inventory", debit: 0, credit: totalCOGS, description: `Inventory reduction for order ${order.trackingNumber} (FIFO)`, referenceType: "order", referenceId: order._id.toString(), actor: req.user!.username },
        ]);
      }

      order.currentStatus = "Completed";
      order.statusHistory.push(
        { status: "Released", timestamp: new Date(), actor: req.user!.username, note: "Items released from inventory" },
        { status: "Completed", timestamp: new Date(), actor: req.user!.username, note: "Order fulfilled" }
      );
      await order.save();

      await logAction("ORDER_RELEASED", req.user!.username, order.trackingNumber);
      emitEvent("ORDER_RELEASED", { orderId: order._id });
      emitEvent("INVENTORY_LOG_CREATED");
      return ok(res, { order, message: "Order released. Inventory updated. Revenue updated." });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ACCOUNTING ─────────────────────────────────────────
  app.get("/api/accounting/accounts", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const accounts = await AccountingAccount.find().sort({ accountCode: 1 });
      return ok(res, accounts);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/accounting/ledger", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const filter: any = {};
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }
      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [entries, total] = await Promise.all([
        GeneralLedgerEntry.find(filter).sort({ date: -1 }).skip(skip).limit(parseInt(pageSize)),
        GeneralLedgerEntry.countDocuments(filter),
      ]);
      return ok(res, { entries, total });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/accounting/ledger", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = ledgerEntrySchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed");
      const entry = await GeneralLedgerEntry.create({ ...parsed.data, date: new Date(parsed.data.date), actor: req.user!.username });
      await logAction("LEDGER_POSTED", req.user!.username, entry.accountName, { debit: entry.debit, credit: entry.credit });
      emitEvent("LEDGER_POSTED");
      return ok(res, entry);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/accounting/summary", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const entries = await GeneralLedgerEntry.find().lean();
      const summary: Record<string, { debit: number; credit: number }> = {};
      for (const e of entries) {
        if (!summary[e.accountName]) summary[e.accountName] = { debit: 0, credit: 0 };
        summary[e.accountName].debit += e.debit;
        summary[e.accountName].credit += e.credit;
      }
      return ok(res, Object.entries(summary).map(([name, vals]) => ({ accountName: name, ...vals, net: vals.debit - vals.credit })));
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── ACCOUNTING REVERSALS ────────────────────────────────
  app.post("/api/accounting/reversals", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { entryId } = req.body;
      if (!entryId) return fail(res, 400, "Entry ID is required");

      const original = await GeneralLedgerEntry.findById(entryId);
      if (!original) return fail(res, 404, "Ledger entry not found");

      const existingReversal = await GeneralLedgerEntry.findOne({ originalEntryId: entryId, isReversing: true });
      if (existingReversal) return fail(res, 400, "This entry has already been reversed");

      const reversalEntry = await GeneralLedgerEntry.create({
        date: new Date(),
        accountName: original.accountName,
        debit: original.credit,
        credit: original.debit,
        description: `Reversal of: ${original.description}`,
        referenceType: "reversal",
        referenceId: original._id.toString(),
        isReversing: true,
        originalEntryId: original._id.toString(),
        actor: req.user!.username,
      });

      await logAction("LEDGER_REVERSED", req.user!.username, original.accountName, {
        originalEntryId: original._id.toString(),
        reversalEntryId: reversalEntry._id.toString(),
        originalDebit: original.debit,
        originalCredit: original.credit,
      });

      emitEvent("LEDGER_POSTED");
      return ok(res, reversalEntry);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── REPORTS ────────────────────────────────────────────
  app.get("/api/reports/sales", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query as Record<string, string>;
      const filter: any = {};
      if (startDate || endDate) {
        filter.paymentDate = {};
        if (startDate) filter.paymentDate.$gte = new Date(startDate);
        if (endDate) filter.paymentDate.$lte = new Date(endDate);
      }
      const payments = await BillingPayment.find(filter).sort({ paymentDate: -1 }).lean();
      const totalRevenue = payments.reduce((s, p) => s + p.amountPaid, 0);
      return ok(res, { payments, totalRevenue, count: payments.length });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/reports/inventory", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const items = await Item.find().sort({ itemName: 1 }).lean();
      const totalValue = items.reduce((s, i) => s + i.unitPrice * i.currentQuantity, 0);
      return ok(res, { items, totalValue, count: items.length });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/reports/forecast", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
      const data = await BillingPayment.aggregate([
        { $match: { paymentDate: { $gte: ninetyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } }, revenue: { $sum: "$amountPaid" } } },
        { $sort: { _id: 1 } },
      ]);

      const dataPoints = data.map(d => ({ date: d._id, value: d.revenue }));
      const result = arimaForecast(dataPoints, 30);

      const combined = [
        ...result.historical.map(p => ({ date: p.date, actual: p.value, forecast: undefined as number | undefined })),
        ...result.forecast.map(p => ({ date: p.date, actual: undefined as number | undefined, forecast: p.value })),
      ];

      return ok(res, { forecast: combined, model: result.model });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── SYSTEM LOGS ────────────────────────────────────────
  app.get("/api/system-logs", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { action, page = "1", pageSize = "20" } = req.query as Record<string, string>;
      const filter: any = {};
      if (action) filter.action = action;
      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [logs, total] = await Promise.all([
        SystemLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)),
        SystemLog.countDocuments(filter),
      ]);
      return ok(res, { logs, total });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── SETTINGS ───────────────────────────────────────────
  app.get("/api/settings", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({ companyName: "JOAP Hardware Trading" });
      return ok(res, settings);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/settings", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) return fail(res, 400, "Validation failed");
      const settings = await Settings.findOneAndUpdate({}, parsed.data, { new: true, upsert: true });
      await logAction("SETTINGS_CHANGED", req.user!.username, "", parsed.data);
      return ok(res, settings);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── SEARCH ─────────────────────────────────────────────
  app.get("/api/search/autocomplete", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { q } = req.query as Record<string, string>;
      if (!q || q.length < 1) return ok(res, { results: [], source: "trie" });
      const results = globalTrie.prefixSearch(q, 10);
      return ok(res, { results, source: "trie" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/lookup/:type/:key", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type, key } = req.params;
      let entry;
      switch (type) {
        case "item": entry = itemIndex.get(key) || barcodeIndex.get(key); break;
        case "order": entry = orderIndex.get(key) || trackingIndex.get(key); break;
        case "customer": entry = customerIndex.get(key); break;
        default: return fail(res, 400, "Invalid type. Use: item, order, customer");
      }
      if (!entry) return fail(res, 404, "Not found in hash index");
      return ok(res, { entry, source: "hash-index", complexity: "O(1)" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/inventory/:id/batches", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const batches = await InventoryBatch.find({ itemId: req.params.id }).sort({ createdAt: 1 }).lean();
      const item = await Item.findById(req.params.id).lean();
      return ok(res, {
        itemName: item?.itemName || "Unknown",
        totalRemaining: batches.reduce((s, b) => s + b.remainingQuantity, 0),
        batches: batches.map(b => ({
          ...b,
          _id: (b as any)._id.toString(),
          depleted: b.remainingQuantity === 0,
        })),
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/dashboard/forecast", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const data = await BillingPayment.aggregate([
        { $match: { paymentDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } }, revenue: { $sum: "$amountPaid" } } },
        { $sort: { _id: 1 } },
      ]);

      const dataPoints = data.map(d => ({ date: d._id, value: d.revenue }));
      const result = arimaForecast(dataPoints, 7);
      const nextWeekTotal = result.forecast.reduce((s, p) => s + p.value, 0);
      const lastWeekTotal = result.historical.slice(-7).reduce((s, p) => s + p.value, 0);
      const trend = lastWeekTotal > 0 ? ((nextWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

      return ok(res, {
        nextWeekForecast: nextWeekTotal,
        trend: Math.round(trend * 10) / 10,
        forecastPoints: result.forecast,
        model: result.model.type,
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/search", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { q } = req.query as Record<string, string>;
      if (!q || q.length < 2) return ok(res, { results: [] });

      const hashResult = trackingIndex.get(q) || barcodeIndex.get(q);
      if (hashResult) {
        return ok(res, { results: [hashResult], source: "hash-index" });
      }

      const trieResults = globalTrie.prefixSearch(q, 15);
      if (trieResults.length > 0) {
        return ok(res, { results: trieResults, source: "trie" });
      }

      const regex = { $regex: q, $options: "i" };
      const [items, customers, orders] = await Promise.all([
        Item.find({ $or: [{ itemName: regex }, { category: regex }, { barcode: regex }] }).limit(5).lean(),
        Customer.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] }).limit(5).lean(),
        Order.find({ $or: [{ trackingNumber: regex }, { customerName: regex }] }).limit(5).lean(),
      ]);

      const results = [
        ...items.map((i) => ({ type: "item" as const, id: i._id.toString(), label: i.itemName, sublabel: i.category || "" })),
        ...customers.map((c) => ({ type: "customer" as const, id: c._id.toString(), label: c.name, sublabel: c.phone || "" })),
        ...orders.map((o) => ({ type: "order" as const, id: o._id.toString(), label: o.trackingNumber, sublabel: o.customerName || "" })),
      ];
      return ok(res, { results, source: "mongodb-regex" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── MAINTENANCE (backup/restore) ──────────────────────
  app.get("/api/maintenance/backup", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const [items, customers, orders, payments, inventoryLogs, accounts, ledger, settings, systemLogs] =
        await Promise.all([
          Item.find().lean(),
          Customer.find().lean(),
          Order.find().lean(),
          BillingPayment.find().lean(),
          InventoryLog.find().lean(),
          AccountingAccount.find().lean(),
          GeneralLedgerEntry.find().lean(),
          Settings.find().lean(),
          SystemLog.find().lean(),
        ]);

      await logAction("BACKUP_CREATED", req.user!.username);
      return ok(res, { items, customers, orders, payments, inventoryLogs, accounts, ledger, settings, systemLogs, exportDate: new Date() });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── HELP / FEEDBACK ───────────────────────────────────
  app.post("/api/feedback", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message, category } = req.body;
      if (!message) return fail(res, 400, "Message is required");
      await SystemLog.create({ action: "FEEDBACK_SUBMITTED", actor: req.user!.username, target: category || "general", metadata: { message } });
      return ok(res, { message: "Feedback submitted" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── MESSAGES ──────────────────────────────────────────
  app.get("/api/messages", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const messages = await SystemLog.find({ action: "EMPLOYEE_MESSAGE" }).sort({ createdAt: -1 }).limit(50).lean();
      return ok(res, messages);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { subject, message } = req.body;
      if (!subject || !message) return fail(res, 400, "Subject and message required");
      await SystemLog.create({
        action: "EMPLOYEE_MESSAGE",
        actor: req.user!.username,
        target: "admin",
        metadata: { subject, message },
      });
      return ok(res, { message: "Message sent" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/messages/:id/read", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const log = await SystemLog.findByIdAndUpdate(req.params.id, { "metadata.read": true }, { new: true });
      if (!log) return fail(res, 404, "Message not found");
      return ok(res, log);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── SERVE TUTORIAL MP3 FILES ─────────────────────────────
  const TUTORIAL_DIR = path.join(process.cwd(), "tutorial_mp3");
  app.get("/api/tutorial-audio/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename;
    if (!/^tut\d+\.mp3$/.test(filename)) return res.status(400).send("Invalid filename");
    const filePath = path.join(TUTORIAL_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  });

  // ─── SERVE UPLOADED IMAGES ────────────────────────────────
  app.get("/api/uploads/:filename", (req: Request, res: Response) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
    res.sendFile(filePath);
  });

  // ─── ITEM IMAGE UPLOAD ────────────────────────────────────
  app.post("/api/items/:id/image", authMiddleware, imageUpload.single("image"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) return fail(res, 404, "Item not found");
      if (!req.file) return fail(res, 400, "No image file provided");

      const filename = req.file.filename;

      if (req.user!.role === "ADMIN") {
        if (item.imageFilename) {
          const oldPath = path.join(UPLOADS_DIR, item.imageFilename);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        item.imageFilename = filename;
        item.imagePending = false;
        item.pendingImageFilename = "";
        item.pendingImageUploadedBy = "";
        await item.save();
        await logAction("ITEM_IMAGE_UPLOADED", req.user!.username, item.itemName, { filename });
      } else {
        if (item.pendingImageFilename) {
          const oldPending = path.join(UPLOADS_DIR, item.pendingImageFilename);
          if (fs.existsSync(oldPending)) fs.unlinkSync(oldPending);
        }
        item.imagePending = true;
        item.pendingImageFilename = filename;
        item.pendingImageUploadedBy = req.user!.username;
        await item.save();
        await ImageApproval.create({
          itemId: item._id,
          filename,
          uploadedBy: req.user!.username,
        });
        await logAction("ITEM_IMAGE_PENDING", req.user!.username, item.itemName, { filename });
      }

      return ok(res, item);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.delete("/api/items/:id/image", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) return fail(res, 404, "Item not found");

      if (item.imageFilename) {
        const filePath = path.join(UPLOADS_DIR, item.imageFilename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      item.imageFilename = "";
      item.imagePending = false;
      item.pendingImageFilename = "";
      item.pendingImageUploadedBy = "";
      await item.save();
      await logAction("ITEM_IMAGE_DELETED", req.user!.username, item.itemName);
      return ok(res, item);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── IMAGE APPROVAL ───────────────────────────────────────
  app.get("/api/image-approvals", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
    try {
      const pending = await ImageApproval.find({ status: "pending" }).sort({ createdAt: -1 }).lean();
      const itemIds = pending.map((p) => p.itemId);
      const items = await Item.find({ _id: { $in: itemIds } }).lean();
      const itemMap = new Map(items.map((i) => [i._id.toString(), i]));
      const result = pending.map((p) => ({
        ...p,
        item: itemMap.get(p.itemId.toString()),
      }));
      return ok(res, result);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/image-approvals/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { action } = req.body;
      const approval = await ImageApproval.findById(req.params.id);
      if (!approval) return fail(res, 404, "Approval not found");

      if (action === "approve") {
        const item = await Item.findById(approval.itemId);
        if (item) {
          if (item.imageFilename) {
            const oldPath = path.join(UPLOADS_DIR, item.imageFilename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          item.imageFilename = approval.filename;
          item.imagePending = false;
          item.pendingImageFilename = "";
          item.pendingImageUploadedBy = "";
          await item.save();
        }
        approval.status = "approved";
        approval.reviewedBy = req.user!.username;
        await approval.save();
        await logAction("ITEM_IMAGE_APPROVED", req.user!.username, item?.itemName || "", { filename: approval.filename });
      } else {
        const filePath = path.join(UPLOADS_DIR, approval.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        const item = await Item.findById(approval.itemId);
        if (item) {
          item.imagePending = false;
          item.pendingImageFilename = "";
          item.pendingImageUploadedBy = "";
          await item.save();
        }
        approval.status = "rejected";
        approval.reviewedBy = req.user!.username;
        await approval.save();
        await logAction("ITEM_IMAGE_REJECTED", req.user!.username, item?.itemName || "", { filename: approval.filename });
      }

      return ok(res, approval);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── BACKUP UPLOAD (RESTORE) ──────────────────────────────
  app.post("/api/maintenance/backup/upload", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const backupData = req.body;
      if (!backupData || typeof backupData !== "object") return fail(res, 400, "Invalid backup data");

      const requiredKeys = ["items", "orders"];
      const hasRequired = requiredKeys.some((key) => Array.isArray(backupData[key]));
      if (!hasRequired) return fail(res, 400, "Backup file must contain valid data (items, orders, etc.)");

      await Promise.all([
        backupData.items?.length > 0 ? Item.deleteMany({}).then(() => Item.insertMany(backupData.items)) : Promise.resolve(),
        backupData.customers?.length > 0 ? Customer.deleteMany({}).then(() => Customer.insertMany(backupData.customers)) : Promise.resolve(),
        backupData.orders?.length > 0 ? Order.deleteMany({}).then(() => Order.insertMany(backupData.orders)) : Promise.resolve(),
        backupData.payments?.length > 0 ? BillingPayment.deleteMany({}).then(() => BillingPayment.insertMany(backupData.payments)) : Promise.resolve(),
        backupData.inventoryLogs?.length > 0 ? InventoryLog.deleteMany({}).then(() => InventoryLog.insertMany(backupData.inventoryLogs)) : Promise.resolve(),
        backupData.accounts?.length > 0 ? AccountingAccount.deleteMany({}).then(() => AccountingAccount.insertMany(backupData.accounts)) : Promise.resolve(),
        backupData.ledger?.length > 0 ? GeneralLedgerEntry.deleteMany({}).then(() => GeneralLedgerEntry.insertMany(backupData.ledger)) : Promise.resolve(),
        backupData.settings?.length > 0 ? Settings.deleteMany({}).then(() => Settings.insertMany(backupData.settings)) : Promise.resolve(),
      ]);

      await logAction("BACKUP_RESTORED", req.user!.username, "", { collections: Object.keys(backupData) });
      return ok(res, { message: "Backup restored successfully" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── AUTO BACKUP SETTINGS ────────────────────────────────
  app.get("/api/maintenance/auto-backup/settings", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
    try {
      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});
      return ok(res, {
        enabled: settings.autoBackupEnabled,
        intervalValue: settings.autoBackupIntervalValue,
        intervalUnit: settings.autoBackupIntervalUnit,
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.patch("/api/maintenance/auto-backup/settings", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { enabled, intervalValue, intervalUnit } = req.body;
      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});

      if (typeof enabled === "boolean") settings.autoBackupEnabled = enabled;
      if (intervalValue !== undefined) settings.autoBackupIntervalValue = Math.max(1, intervalValue);
      if (intervalUnit) settings.autoBackupIntervalUnit = intervalUnit;
      await settings.save();

      setupAutoBackupScheduler(settings.autoBackupIntervalValue, settings.autoBackupIntervalUnit, settings.autoBackupEnabled);

      await logAction("AUTO_BACKUP_SETTINGS_CHANGED", req.user!.username, "", {
        enabled: settings.autoBackupEnabled,
        interval: `${settings.autoBackupIntervalValue} ${settings.autoBackupIntervalUnit}`,
      });

      return ok(res, {
        enabled: settings.autoBackupEnabled,
        intervalValue: settings.autoBackupIntervalValue,
        intervalUnit: settings.autoBackupIntervalUnit,
      });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.post("/api/maintenance/auto-backup/trigger", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      await performAutoBackup();
      return ok(res, { message: "Manual backup created" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── BACKUP HISTORY ──────────────────────────────────────
  app.get("/api/maintenance/backup/history", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const { page = "1", pageSize = "5" } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      const [history, total] = await Promise.all([
        BackupHistory.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize)).lean(),
        BackupHistory.countDocuments(),
      ]);
      return ok(res, { history, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  app.get("/api/maintenance/backup/download/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const record = await BackupHistory.findById(req.params.id);
      if (!record) return fail(res, 404, "Backup not found");

      const filePath = path.join(BACKUPS_DIR, record.filename);
      if (!fs.existsSync(filePath)) return fail(res, 404, "Backup file not found on disk");

      res.download(filePath, record.filename);
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── DEVELOPER WIPE ──────────────────────────────────────
  app.post("/api/maintenance/wipe", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      await Promise.all([
        Item.deleteMany({}),
        Customer.deleteMany({}),
        Order.deleteMany({}),
        BillingPayment.deleteMany({}),
        InventoryLog.deleteMany({}),
        AccountingAccount.deleteMany({}),
        GeneralLedgerEntry.deleteMany({}),
        SystemLog.deleteMany({}),
        BackupHistory.deleteMany({}),
        ImageApproval.deleteMany({}),
      ]);

      const uploadFiles = fs.readdirSync(UPLOADS_DIR);
      uploadFiles.forEach((f) => {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
      });
      const backupFiles = fs.readdirSync(BACKUPS_DIR);
      backupFiles.forEach((f) => {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch {}
      });

      await logAction("SYSTEM_WIPE", req.user!.username, "", { action: "complete_wipe" });
      return ok(res, { message: "All data has been wiped" });
    } catch (err: any) {
      return fail(res, 500, err.message);
    }
  });

  // ─── GEMINI AI ENDPOINTS ──────────────────────────

  async function gatherSystemData(userId?: string) {
    const [items, orders, payments, users, inventoryLogs, systemLogs, accounts, ledger, customers] = await Promise.all([
      Item.find({}).lean().then(docs => docs.map(d => ({ name: d.name, category: d.category, price: d.price, stock: d.stock }))),
      Order.find({}).sort({ createdAt: -1 }).limit(100).lean().then(docs => docs.map(d => ({
        trackingNumber: d.trackingNumber, customerName: d.customerName, totalAmount: d.totalAmount,
        currentStatus: d.currentStatus, sourceChannel: d.sourceChannel, items: d.items?.length || 0,
        createdAt: d.createdAt,
      }))),
      BillingPayment.find({}).sort({ paymentDate: -1 }).limit(100).lean().then(docs => docs.map(d => ({
        orderId: d.orderId, amountPaid: d.amountPaid, paymentMethod: d.paymentMethod,
        gcashNumber: d.gcashNumber, gcashReferenceNumber: d.gcashReferenceNumber,
        loggedBy: d.loggedBy, paymentDate: d.paymentDate,
      }))),
      User.find({}).lean().then(docs => docs.map(d => ({
        username: d.username, role: d.role, active: d.active, lastLogin: d.lastLogin,
      }))),
      InventoryLog.find({}).sort({ createdAt: -1 }).limit(100).lean().then(docs => docs.map(d => ({
        itemName: d.itemName, type: d.type, quantity: d.quantity, reason: d.reason, actor: d.actor, createdAt: d.createdAt,
      }))),
      SystemLog.find({}).sort({ createdAt: -1 }).limit(100).lean().then(docs => docs.map(d => ({
        action: d.action, actor: d.actor, target: d.target, createdAt: d.createdAt,
      }))),
      AccountingAccount.find({}).lean().then(docs => docs.map(d => ({
        accountName: d.accountName, accountType: d.accountType, balance: d.balance,
      }))),
      GeneralLedgerEntry.find({}).sort({ date: -1 }).limit(50).lean().then(docs => docs.map(d => ({
        date: d.date, description: d.description, debitAccount: d.debitAccount,
        creditAccount: d.creditAccount, amount: d.amount,
      }))),
      Customer.find({}).lean().then(docs => docs.map(d => ({
        name: d.name, email: d.email, phone: d.phone,
      }))),
    ]);

    const totalRevenue = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.currentStatus === "Pending Payment").length;
    const completedOrders = orders.filter(o => o.currentStatus === "Completed").length;
    const uniqueCustomers = new Set(orders.map(o => o.customerName).filter(Boolean)).size;
    const currentDate = new Date().toISOString();

    const loginLogs = userId
      ? systemLogs.filter(l => l.action === "LOGIN" && l.actor === userId)
      : [];

    return {
      currentDate,
      summary: { totalRevenue, totalOrders, pendingOrders, completedOrders, totalItems: items.length, totalUsers: users.length, totalCustomers: customers.length, uniqueCustomersWithOrders: uniqueCustomers },
      items, orders, payments, users, customers, inventoryLogs, systemLogs, accounts, ledger,
      loginLogsForCurrentUser: loginLogs,
    };
  }

  async function callGeminiText(prompt: string): Promise<string> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Requested models in order of preference
    const models = [
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ];

    let lastError = "";

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        const data = await response.json() as any;
        if (response.ok) {
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
        }
        lastError = data.error?.message || "Unknown error";
        console.warn(`Gemini model ${model} failed: ${lastError}`);
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Error calling Gemini model ${model}: ${lastError}`);
      }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError}`);
  }

  async function callGeminiTTS(textToSpeak: string): Promise<{ text: string; audioBase64: string; mimeType: string }> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const ttsPrompt = `Say the following in a friendly, helpful tone: ${textToSpeak}`;

    const models = [
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ];

    let lastError = "";

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: ttsPrompt }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Leda" },
                  },
                },
              },
            }),
          }
        );

        const data = await response.json() as any;
        if (response.ok) {
          const part = data.candidates?.[0]?.content?.parts?.[0];
          const audioBase64 = part?.inlineData?.data || "";
          if (audioBase64) {
            const mimeType = part?.inlineData?.mimeType || "audio/L16;codec=pcm;rate=24000";
            return { text: textToSpeak, audioBase64, mimeType };
          }
        }
        lastError = data.error?.message || "No audio returned";
        console.warn(`Gemini TTS model ${model} failed: ${lastError}`);
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Error calling Gemini TTS model ${model}: ${lastError}`);
      }
    }

    throw new Error(`All Gemini TTS models failed. Last error: ${lastError}`);
  }

  app.post("/api/gemini-chat", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) return fail(res, 400, "Message is required");

      const fullData = await gatherSystemData(req.user?.username);

      const prompt = `You are JOAP Hardware Trading's AI assistant. Answer using ONLY the provided system data. Be concise, helpful, and accurate. Format numbers as PHP currency where appropriate. Today's date is ${fullData.currentDate}.

User question: ${message}

System data:
${JSON.stringify(fullData, null, 0)}`;

      const text = await callGeminiText(prompt);
      return ok(res, { text });
    } catch (err: any) {
      console.error("Gemini chat error:", err.message);
      return fail(res, 500, err.message || "AI chat failed");
    }
  });

  function pcmToWavBase64(pcmBase64: string, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): string {
    const pcmBuffer = Buffer.from(pcmBase64, "base64");
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const wavHeaderSize = 44;
    const wavBuffer = Buffer.alloc(wavHeaderSize + pcmBuffer.length);

    wavBuffer.write("RIFF", 0);
    wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
    wavBuffer.write("WAVE", 8);
    wavBuffer.write("fmt ", 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20);
    wavBuffer.writeUInt16LE(channels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(byteRate, 28);
    wavBuffer.writeUInt16LE(blockAlign, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);
    wavBuffer.write("data", 36);
    wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
    pcmBuffer.copy(wavBuffer, 44);

    return wavBuffer.toString("base64");
  }

  app.post("/api/voice-insight", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { question, clickedPoint } = req.body;
      if (!question) return fail(res, 400, "Question is required");

      const fullData = await gatherSystemData(req.user?.username);

      const textPrompt = `You are a business analytics voice assistant for JOAP Hardware Trading. Answer using ONLY the provided JSON data. Be concise, speak naturally in 2-3 sentences max. Today's date is ${fullData.currentDate}.

IMPORTANT: The user clicked on a specific dashboard card/chart element. The "Clicked data point" below contains the EXACT values currently displayed on the dashboard for that element. These values are the authoritative, filtered numbers for the selected time period. When the user asks about the value of the clicked element, use the values from "Clicked data point" as the definitive answer. Do NOT recalculate or count from the raw data below — the raw data is unfiltered and may cover different time periods.

Clicked data point: ${JSON.stringify(clickedPoint || {})}

User question: ${question}

Raw system data (for additional context only, NOT for recounting dashboard values):
${JSON.stringify(fullData, null, 0)}`;

      const textAnswer = await callGeminiText(textPrompt);

      let audioBase64 = "";
      try {
        const ttsResult = await callGeminiTTS(textAnswer);
        if (ttsResult.audioBase64) {
          const sampleRate = parseInt(ttsResult.mimeType.match(/rate=(\d+)/)?.[1] || "24000");
          audioBase64 = pcmToWavBase64(ttsResult.audioBase64, sampleRate);
          console.log(`TTS: generated ${audioBase64.length} chars of WAV audio (${sampleRate}Hz)`);
        } else {
          console.warn("TTS: Gemini returned empty audio data");
        }
      } catch (ttsErr: any) {
        console.error("TTS generation failed (returning text only):", ttsErr.message);
      }

      return ok(res, { text: textAnswer, audioBase64 });
    } catch (err: any) {
      console.error("Voice insight error:", err.message);
      return fail(res, 500, err.message || "Voice generation failed");
    }
  });

  return httpServer;
}
