import mongoose, { Schema, Document } from "mongoose";

export interface IImageApprovalDoc extends Document {
  itemId: mongoose.Types.ObjectId;
  filename: string;
  uploadedBy: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const imageApprovalSchema = new Schema<IImageApprovalDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    filename: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: String },
  },
  { timestamps: true }
);

imageApprovalSchema.index({ status: 1 });
imageApprovalSchema.index({ itemId: 1 });

export default mongoose.model<IImageApprovalDoc>("ImageApproval", imageApprovalSchema);
