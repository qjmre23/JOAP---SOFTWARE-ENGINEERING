import mongoose, { Schema, Document } from "mongoose";

export interface IInventoryLogDoc extends Document {
  itemId: mongoose.Types.ObjectId;
  itemName: string;
  type: "restock" | "deduction" | "adjustment";
  quantity: number;
  reason: string;
  actor: string;
  createdAt: Date;
}

const inventoryLogSchema = new Schema<IInventoryLogDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String, required: true },
    type: { type: String, enum: ["restock", "deduction", "adjustment"], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, default: "" },
    actor: { type: String, required: true },
  },
  { timestamps: true }
);

inventoryLogSchema.index({ itemId: 1 });
inventoryLogSchema.index({ createdAt: -1 });

export default mongoose.model<IInventoryLogDoc>("InventoryLog", inventoryLogSchema);
