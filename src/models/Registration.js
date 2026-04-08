import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const registrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'பெயர் தேவை'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'தொலைபேசி எண் தேவை'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'சரியான தொலைபேசி எண் கொடுக்கவும்'],
    },
    email: {
      type: String,
      required: [true, 'மின்னஞ்சல் தேவை'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'சரியான மின்னஞ்சல் கொடுக்கவும்'],
    },
    standard: {
      type: String,
      required: [true, 'வகுப்பு தேவை'],
      enum: ['9', '10', '11', '12', 'other'],
    },
    school: {
      type: String,
      required: [true, 'பள்ளி பெயர் தேவை'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'நகரம் தேவை'],
      trim: true,
    },
    parentName: {
      type: String,
      trim: true,
    },
    parentPhone: {
      type: String,
      trim: true,
    },
    howHeard: {
      type: String,
      enum: ['friend', 'social_media', 'school', 'family', 'other', ''],
      default: '',
    },
    // ─── Attendance ───────────────────────────────────────────────────────────
    qrToken: {
      type: String,
      unique: true,
      default: () => randomUUID(),
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate registrations by phone
registrationSchema.index({ phone: 1 }, { unique: true });

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
