const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  serviceType: { 
    type: String 
  },
  date: { 
    type: Date 
  },
  time: { 
    type: Date 
  },
  description: { 
    type: String 
  },
  location: { 
    type: String 
  },
  attachments: [{ 
    type: String // This will store file URLs or base64 data for attachments
  }],
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'completed'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  completedAt: { 
    type: Date 
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  review: { 
    type: String 
  },
});

module.exports = mongoose.model('Request', requestSchema);
