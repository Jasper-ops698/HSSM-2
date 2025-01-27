const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    price: {
      type: Number,
      min: [0, 'Price must be greater than or equal to 0'],
      max: [35000, 'Price must be less than or equal to 35000'],
      required: [true, 'Price is required'],
    },
    image: {
      type: String, // Store the file path or URL
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
