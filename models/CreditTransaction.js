const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['add', 'deduct', 'transfer', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  previousBalance: {
    type: Number,
    required: true,
    min: 0
  },
  newBalance: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionType: {
    type: String,
    enum: ['manual', 'automatic', 'system'],
    default: 'manual'
  },
  reference: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for efficient queries
creditTransactionSchema.index({ user: 1, createdAt: -1 });
creditTransactionSchema.index({ performedBy: 1, createdAt: -1 });
creditTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);