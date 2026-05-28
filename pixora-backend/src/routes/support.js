const express = require('express');
const router = express.Router();
const { submitHelpRequest } = require('../controllers/supportController');

router.post('/help', submitHelpRequest);

module.exports = router;
