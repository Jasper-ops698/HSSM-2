const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  location: {
    type: String,
    required: false,
    trim: true,
  },
  capacity: {
    type: Number,
    required: false,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue;
