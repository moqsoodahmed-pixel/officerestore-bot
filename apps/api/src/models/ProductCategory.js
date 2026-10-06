'use strict';

const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  label: { type: String, required: true },
  description: { type: String },
  emoji: { type: String },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  externalCategoryId: { type: String },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ProductCategory', productCategorySchema);
