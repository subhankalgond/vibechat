const express = require('express');
const messagesController = require('../controllers/messagesController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:conversationId', messagesController.list);
router.post('/', messagesController.send);
router.put('/:id/seen', messagesController.seen);
router.delete('/:id', messagesController.deleteForMe);

module.exports = router;
