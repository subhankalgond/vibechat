const express = require('express');
const usersController = require('../controllers/usersController');
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/auth');
const { memoryUpload, withLimits } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/search', usersController.search);
router.get('/:username', usersController.getByUsername);
router.put('/profile', usersController.updateProfile);
router.put('/avatar', withLimits('image'), memoryUpload().single('image'), uploadController.updateAvatar);

module.exports = router;
