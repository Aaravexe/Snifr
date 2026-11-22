const express = require('express');
const controller = require('../controllers/bookingController');
const { allow } = require('../middleware/dashboardAccess');

const router = express.Router();

router.get('/walkers/:walkerId/booking-details', controller.getBookingDetails);
router.get('/local/bookings', allow('admin'), controller.localBackups);
router.use('/bookings', allow('consumer', 'walker', 'admin'), controller.bindBookingScope);
router.get('/bookings/latest', controller.getLatestBooking);
router.route('/bookings').get(controller.listBookings).post(controller.createBooking);
router.route('/bookings/:id').get(controller.getBooking).patch(controller.updateBooking).delete(controller.deleteBooking);

module.exports = router;
