const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const createAdminUser = async () => {
  await connectDB();

  const adminExists = await User.findOne({ email: 'nyaleemmanuel5@gmail.com' });

  if (adminExists) {
    console.log('Admin user already exists');
    process.exit(1);
  }

  const admin = new User({
    name: 'Emmanuel Nyale',
    email: 'nyaleemmanuel5@gmail.com',
    password: bcrypt.hashSync(process.env.ADMIN, 10),
    phone: process.env.PHONE,
    role: 'admin',
  });

  await admin.save();
  console.log('Admin user created successfully');
  process.exit();
};

createAdminUser();
