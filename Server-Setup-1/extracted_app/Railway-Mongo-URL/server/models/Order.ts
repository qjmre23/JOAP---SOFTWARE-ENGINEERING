import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItemSub {
  itemId: mongoose.Types.ObjectId;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IStatusEntrySub {
  status: string;
  timestamp: Date;
  actor: string;
  note: string;
}

export interface IAddressSub {
  street: string;
  unitNumber: string;
  city: string;
  province: string;
  zipCode: string;
}

export interface IOrderDoc extends Document {
  trackingNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  items: IOrderItemSub[];
  totalAmount: number;
  sourceChannel: string;
  notes: string;
  currentStatus: string;
  statusHistory: IStatusEntrySub[];
  address?: IAddressSub;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItemSub>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const statusEntrySchema = new Schema<IStatusEntrySub>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrderDoc>(
  {
    trackingNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    sourceChannel: { type: String, default: "walk-in" },
    notes: { type: String, default: "" },
    currentStatus: { type: String, default: "Pending Payment" },
    statusHistory: [statusEntrySchema],
    address: {
      type: {
        street: { type: String, default: "" },
        unitNumber: { type: String, default: "" },
        city: { type: String, default: "" },
        province: { type: String, default: "" },
        zipCode: { type: String, default: "" },
      },
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

orderSchema.index({ currentStatus: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model<IOrderDoc>("Order", orderSchema);
