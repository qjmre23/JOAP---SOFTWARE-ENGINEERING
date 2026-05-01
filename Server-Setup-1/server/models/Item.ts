import mongoose, { Schema, Document } from "mongoose";

export interface IItemDoc extends Document {
  itemName: string;
  category: string;
  supplierName: string;
  unitPrice: number;
  currentQuantity: number;
  reorderLevel: number;
  barcode: string;
  imageFilename: string;
  imagePending: boolean;
  pendingImageFilename: string;
  pendingImageUploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IItemDoc>(
  {
    itemName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    supplierName: { type: String, default: "" },
    unitPrice: { type: Number, required: true, min: 0 },
    currentQuantity: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, default: 10 },
    barcode: { type: String, default: "" },
    imageFilename: { type: String, default: "" },
    imagePending: { type: Boolean, default: false },
    pendingImageFilename: { type: String, default: "" },
    pendingImageUploadedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

itemSchema.index({ itemName: "text", category: "text" });
itemSchema.index({ category: 1 });

export default mongoose.model<IItemDoc>("Item", itemSchema);
