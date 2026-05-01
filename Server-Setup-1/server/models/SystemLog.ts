import mongoose, { Schema, Document } from "mongoose";

export interface ISystemLogDoc extends Document {
  action: string;
  actor: string;
  target: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

const systemLogSchema = new Schema<ISystemLogDoc>(
  {
    action: { type: String, required: true },
    actor: { type: String, required: true },
    target: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

systemLogSchema.index({ action: 1 });
systemLogSchema.index({ createdAt: -1 });

export default mongoose.model<ISystemLogDoc>("SystemLog", systemLogSchema);
