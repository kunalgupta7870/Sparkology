const InventoryItem = require('../models/InventoryItem');
const { validationResult } = require('express-validator');

const createItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });

    const schoolId = req.user.schoolId;
    const createdBy = req.user._id;
    const data = { ...req.body, schoolId, createdBy };

    const item = await InventoryItem.create(data);
    res.status(201).json({ success: true, message: 'Inventory item created', data: item });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ success: false, error: 'Server error while creating inventory item' });
  }
};

const getItems = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 50, search } = req.query;
    const query = { schoolId, isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await InventoryItem.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await InventoryItem.countDocuments(query);

    res.json({ success: true, data: items, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total/parseInt(limit)), totalItems: total } });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching inventory items' });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, schoolId: req.user.schoolId, isActive: true });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Get inventory item by id error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching item' });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

    Object.assign(item, req.body);
    await item.save();

    res.json({ success: true, message: 'Inventory item updated', data: item });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ success: false, error: 'Server error while updating item' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

    item.isActive = false;
    await item.save();

    res.json({ success: true, message: 'Inventory item deleted' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ success: false, error: 'Server error while deleting item' });
  }
};

module.exports = { createItem, getItems, getItemById, updateItem, deleteItem };
