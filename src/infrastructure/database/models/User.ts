import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  role: "SUPER_ADMIN" | "FINANCE_ADMIN" | "HR_ADMIN" | "AUDITOR" | "VIEWER";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "FINANCE_ADMIN", "HR_ADMIN", "AUDITOR", "VIEWER"],
      default: "VIEWER"
    },
  },
  { timestamps: true, collection: "user" }
);

// If model already exists, we might need to recreate it if it doesn't have the correct collection name
// but in Next.js development, models can be cached. This ensures we use the one with explicit collection.
if (mongoose.models.User) {
  delete mongoose.models.User;
}

export const UserModel = mongoose.model<IUser>("User", UserSchema);
