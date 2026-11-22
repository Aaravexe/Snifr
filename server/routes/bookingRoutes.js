const express = require('express');
const controller = require('../controllers/bookingController');

const router = express.Router();

router.get('/walkers/:walkerId/booking-details', controller.getBookingDetails);
router.get('/local/bookings', controller.localBackups);
router.get('/bookings/latest', controller.getLatestBooking);
router.route('/bookings').get(controller.listBookings).post(controller.createBooking);
router.route('/bookings/:id').get(controller.getBooking).patch(controller.updateBooking).delete(controller.deleteBooking);

module.exports = router;
