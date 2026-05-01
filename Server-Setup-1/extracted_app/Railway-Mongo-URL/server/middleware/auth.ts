import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import UserSession from "../models/UserSession";
import User from "../models/User";

const JWT_SECRET = process.env.SESSION_SECRET || "joap-hardware-secret-key";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    username: string;
    role: "ADMIN" | "EMPLOYEE";
  };
}

export function generateToken(payload: { _id: string; username: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { _id: string; username: string; role: "ADMIN" | "EMPLOYEE" };

    const session = await UserSession.findOne({ token, isActive: true });
    if (!session) {
      return res.status(401).json({ success: false, error: "Session expired or invalid" });
    }

    const user = await User.findById(decoded._id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: "Account is inactive" });
    }

    session.lastActivity = new Date();
    await session.save();

    req.user = { _id: decoded._id, username: decoded.username, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}
