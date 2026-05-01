import mongoose, { Schema, Document } from "mongoose";

export interface IAccountingAccountDoc extends Document {
  accountCode: string;
  accountName: string;
  accountType: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const accountingAccountSchema = new Schema<IAccountingAccountDoc>(
  {
    accountCode: { type: String, required: true, unique: true },
    accountName: { type: String, required: true },
    accountType: { type: String, required: true, enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"] },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IAccountingAccountDoc>("AccountingAccount", accountingAccountSchema);
