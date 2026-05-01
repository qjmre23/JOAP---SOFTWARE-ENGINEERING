import mongoose, { Schema, Document } from "mongoose";

export interface ICustomerDoc extends Document {
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomerDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text" });

export default mongoose.model<ICustomerDoc>("Customer", customerSchema);
