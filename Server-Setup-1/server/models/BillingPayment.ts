import mongoose, { Schema, Document } from "mongoose";

export interface IBillingPaymentDoc extends Document {
  orderId: mongoose.Types.ObjectId;
  paymentMethod: string;
  gcashNumber: string;
  gcashReferenceNumber: string;
  amountPaid: number;
  paymentDate: Date;
  proofNote: string;
  loggedBy: string;
  createdAt: Date;
}

const billingPaymentSchema = new Schema<IBillingPaymentDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    paymentMethod: { type: String, default: "GCash" },
    gcashNumber: { type: String, required: true },
    gcashReferenceNumber: { type: String, required: true, unique: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, default: Date.now },
    proofNote: { type: String, default: "" },
    loggedBy: { type: String, required: true },
  },
  { timestamps: true }
);

billingPaymentSchema.index({ orderId: 1 });

export default mongoose.model<IBillingPaymentDoc>("BillingPayment", billingPaymentSchema);
