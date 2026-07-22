const express = require('express');
const { listItems, createItem, deleteItem } = require('../services/itemsService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await listItems() });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await createItem(req.body && req.body.text);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteItem(req.params.id);
    if (!ok) return res.status(404).json({ error: 'no encontrado' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
