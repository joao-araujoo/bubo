const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const readingPreferencesSchema = new mongoose.Schema({
  primaryGoal: {
    type: String,
    enum: ['retain', 'reflect', 'consistency', 'community'],
    default: 'retain'
  },
  pace: {
    type: String,
    enum: ['casual', 'steady', 'intensive'],
    default: 'steady'
  },
  favoriteGenres: {
    type: [{ type: String, trim: true, maxlength: 40 }],
    default: [],
    validate: {
      validator: (genres) => genres.length <= 6,
      message: 'Choose up to six favorite genres'
    }
  },
  weeklyReviewTarget: {
    type: Number,
    default: 2,
    min: 1,
    max: 14
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: '', trim: true, maxlength: 1000 },
  bio: {
    type: String,
    default: 'Lendo para lembrar, escrever melhor e conectar ideias.',
    trim: true,
    maxlength: 240
  },
  readingGoal: { type: Number, default: 20, min: 1, max: 365 },
  readingPreferences: {
    type: readingPreferencesSchema,
    default: () => ({})
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  onboardingCompletedAt: {
    type: Date,
    default: null
  },
  achievements: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
