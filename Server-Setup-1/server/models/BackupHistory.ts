import mongoose, { Schema, Document } from "mongoose";

export interface IBackupHistoryDoc extends Document {
  filename: string;
  size: number;
  source: "manual" | "auto";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const backupHistorySchema = new Schema<IBackupHistoryDoc>(
  {
    filename: { type: String, required: true },
    size: { type: Number, default: 0 },
    source: { type: String, enum: ["manual", "auto"], default: "manual" },
    createdBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

backupHistorySchema.index({ createdAt: -1 });

export default mongoose.model<IBackupHistoryDoc>("BackupHistory", backupHistorySchema);
