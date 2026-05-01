import mongoose, { Schema, Document } from "mongoose";

export interface IUserDoc extends Document {
  username: string;
  password: string;
  role: "ADMIN" | "EMPLOYEE";
  isActive: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "EMPLOYEE"], default: "EMPLOYEE" },
    isActive: { type: Boolean, default: true },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IUserDoc>("User", userSchema);
