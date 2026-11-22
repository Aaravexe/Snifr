const router = require('express').Router();
const controller = require('../controllers/authController');
const { identify, allow, requireMongo } = require('../middleware/dashboardAccess');

router.post('/register', requireMongo, controller.register);
router.post('/login', requireMongo, controller.login);
router.post('/logout', identify, require('../middleware/dashboardAccess').logout);
router.delete('/account', identify, allow('consumer', 'walker'), requireMongo, controller.deactivate);
router.patch('/password', identify, allow('consumer', 'walker', 'admin'), requireMongo, controller.changePassword);

module.exports = router;
