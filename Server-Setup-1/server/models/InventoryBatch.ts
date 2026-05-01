import mongoose, { Schema, Document } from "mongoose";

export interface IInventoryBatch extends Document {
  itemId: mongoose.Types.ObjectId;
  quantity: number;
  remainingQuantity: number;
  unitCost: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryBatchSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    source: { type: String, default: "restock" },
  },
  { timestamps: true }
);

inventoryBatchSchema.index({ itemId: 1, createdAt: 1 });

export default mongoose.model<IInventoryBatch>("InventoryBatch", inventoryBatchSchema);
