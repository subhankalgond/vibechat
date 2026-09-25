const express = require('express');
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/auth');
const { memoryUpload, withLimits } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.post('/image', withLimits('image'), memoryUpload().single('image'), uploadController.uploadImage);
router.post('/video', withLimits('video'), memoryUpload().single('video'), uploadController.uploadVideo);

module.exports = router;
