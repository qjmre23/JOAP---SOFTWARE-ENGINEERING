import mongoose from "mongoose";
import { log } from "./index";

const MONGODB_URI = process.env.MONGODB_URI || "";

export async function connectDB() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("MONGODB_URI is not configured. Please set the MONGODB_URI environment variable.");
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI, { dbName: "joap_hardware" });
    log("Connected to MongoDB", "mongoose");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
