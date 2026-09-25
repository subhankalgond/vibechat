const express = require('express');
const conversationsController = require('../controllers/conversationsController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', conversationsController.list);
router.post('/', conversationsController.create);
router.get('/:id', conversationsController.getOne);
router.delete('/:id', conversationsController.remove);

module.exports = router;
