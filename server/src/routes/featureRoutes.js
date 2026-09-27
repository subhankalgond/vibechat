const express = require('express');
const callsController = require('../controllers/callsController');
const statusesController = require('../controllers/statusesController');
const communitiesController = require('../controllers/communitiesController');
const vibeaiController = require('../controllers/vibeaiController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Calls
router.get('/calls', callsController.list);
router.delete('/calls/:id', callsController.remove);

// Statuses
router.get('/statuses', statusesController.list);
router.post('/statuses', statusesController.create);
router.delete('/statuses/:id', statusesController.remove);
router.post('/statuses/:id/view', statusesController.view);
router.get('/statuses/:id/views', statusesController.viewers);

// Communities
router.get('/communities', communitiesController.list);
router.post('/communities', communitiesController.create);
router.post('/communities/join', communitiesController.join);
router.delete('/communities/:id', communitiesController.remove);
router.post('/communities/:id/events', communitiesController.createEvent);
router.post('/communities/events/:eventId/rsvp', communitiesController.rsvp);

// VibeAI
router.post('/vibeai/chat', vibeaiController.chat);
router.post('/vibeai/translate', vibeaiController.translate);
router.post('/vibeai/summarize', vibeaiController.summarize);

module.exports = router;
