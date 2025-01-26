const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the User schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Please enter a valid email',
      },
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ['individual', 'service-provider', 'admin', 'HSSM-provider'],
      required: true,
      default: 'individual', // Default role is 'individual'
    },
    deviceToken: { 
      type: String, 
      required: false 
    }, // For FCM device token
  },
  { timestamps: true }
);

// Add indexes for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

// Custom method to exclude sensitive fields (like password) from user data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password; // Remove the password field
  return user;
};

// Export the User model
module.exports = mongoose.model('User', userSchema);