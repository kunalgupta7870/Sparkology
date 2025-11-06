const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true },
  description: { type: String },
  quantity: { type: Number, default: 0 },
  location: { type: String },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

inventorySchema.index({ schoolId: 1, sku: 1 });

module.exports = mongoose.model('InventoryItem', inventorySchema);
