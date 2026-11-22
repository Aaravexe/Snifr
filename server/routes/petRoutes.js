const router = require('express').Router();
const pets = require('../controllers/petController');
const { allow, requireMongo } = require('../middleware/dashboardAccess');
router.use(allow('consumer','admin'), requireMongo);
router.route('/').get(pets.list).post(pets.create);
router.route('/:id').get(pets.get).patch(pets.update).delete(pets.remove);
module.exports = router;
