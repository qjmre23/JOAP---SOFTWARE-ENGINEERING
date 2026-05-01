import mongoose, { Schema, Document } from "mongoose";

export interface IUserSessionDoc extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSessionSchema = new Schema<IUserSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSessionSchema.index({ userId: 1 });

export default mongoose.model<IUserSessionDoc>("UserSession", userSessionSchema);
