import mongoose, { Schema, Document } from "mongoose";

export interface IGeneralLedgerEntryDoc extends Document {
  date: Date;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  referenceType: string;
  referenceId: string;
  isReversing: boolean;
  actor: string;
  createdAt: Date;
}

const generalLedgerEntrySchema = new Schema<IGeneralLedgerEntryDoc>(
  {
    date: { type: Date, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    description: { type: String, default: "" },
    referenceType: { type: String, default: "" },
    referenceId: { type: String, default: "" },
    isReversing: { type: Boolean, default: false },
    actor: { type: String, default: "" },
  },
  { timestamps: true }
);

generalLedgerEntrySchema.index({ date: -1 });
generalLedgerEntrySchema.index({ accountName: 1 });

export default mongoose.model<IGeneralLedgerEntryDoc>("GeneralLedgerEntry", generalLedgerEntrySchema);
