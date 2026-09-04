import mongoose from "mongoose";

const locationCurrentSchema = new mongoose.Schema(
  {
    type: { type: String },
    coordinates: { type: [Number] }, // GeoJSON order: [lng, lat]
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    capturedAt: { type: Date },
    ipAddress: { type: String },
  },
  { _id: false },
);

const locationHistorySchema = new mongoose.Schema(
  {
    coordinates: { type: [Number] }, // [lng, lat]
    address: { type: String },
    capturedAt: { type: Date },
    event: { type: String },
    ipAddress: { type: String },
  },
  { _id: false },
);

const locationDataSchema = new mongoose.Schema(
  {
    current: { type: locationCurrentSchema, default: null },
    history: { type: [locationHistorySchema], default: [] },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    verificationNotes: { type: String, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    phoneNumber: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    location: { type: String },
    profilePicture: { type: String },
    password: { type: String },
    isVerified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    role: { type: String, enum: ["user", "counsellor"], default: "user", index: true },

    locationConsent: { type: Boolean, default: false },
    locationData: { type: locationDataSchema, default: () => ({}) },

    // Counselor-specific fields
    specialization: [String],
    experience: { type: Number },
    languages: [String],
    rating: { type: Number, default: 0 },
    hourlyRate: { type: Number },
    sessionsDone: { type: Number, default: 0 },
    bio: { type: String },
    availability: { type: String },
    walletBalance: { type: Number, default: 0 },
    activeWalletRefundRequest: { type: Boolean, default: false },
    walletCreditPaymentIds: { type: [String], default: [], select: false },
    walletAdjustmentIds: { type: [String], default: [], select: false },

    // Chat permission — controls whether counselor can chat with users
    chatPermission: {
      enabled: { type: Boolean, default: true },
      disabledReason: { type: String, default: null },
      disabledBy: { type: String, enum: ["admin", "system"], default: null },
      disabledAt: { type: Date, default: null },
      notes: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
