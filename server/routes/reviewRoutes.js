const router = require('express').Router();
const reviews = require('../controllers/reviewController');
const { allow, requireMongo } = require('../middleware/dashboardAccess');
router.use(allow('consumer','admin'), requireMongo);
router.route('/').get(reviews.list).post(reviews.create);
router.route('/:id').get(reviews.get).patch(reviews.update).delete(reviews.remove);
module.exports = router;
