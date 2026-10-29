const dateButtons = [...document.querySelectorAll('.date-option')];
const timeButtons = [...document.querySelectorAll('.time-option')];
const bookingForm = document.querySelector('#booking-form');
const dateTimeSummary = document.querySelector('#booking-date-time');
const petSelect = document.querySelector('#pet-select');
const bookingMessage = document.querySelector('#booking-message');
const cancelBookingButton = document.querySelector('#cancel-booking');
const confirmationDialog = document.querySelector('#confirmation-dialog');
const confirmationDetails = document.querySelector('#confirmation-details');
const submitBookingButton = document.querySelector('#submit-booking');

let selectedDate = '';
let selectedTime = '';

function setSelectedButton(buttons, selectedButton) {
    buttons.forEach(button => {
        const isSelected = button === selectedButton;
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
    });
}

function updateBookingSummary() {
    dateTimeSummary.textContent = selectedDate && selectedTime
        ? `${selectedDate} @ ${selectedTime}`
        : 'Select a date and time';
}

function showMessage(message, type = '') {
    bookingMessage.textContent = message;
    bookingMessage.className = `booking-message ${type}`.trim();
}

dateButtons.forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
        setSelectedButton(dateButtons, button);
        selectedDate = button.dataset.date;
        updateBookingSummary();
        showMessage('');
    });
});

timeButtons.forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
        setSelectedButton(timeButtons, button);
        selectedTime = button.textContent.trim();
        updateBookingSummary();
        showMessage('');
    });
});

petSelect.addEventListener('change', () => {
    showMessage(petSelect.value ? `Selected pet: ${petSelect.value}` : '', 'success');
});

function validateBooking() {
    const missingFields = [];

    if (!petSelect.value) missingFields.push('a pet');
    if (!selectedDate) missingFields.push('a date');
    if (!selectedTime) missingFields.push('a time slot');

    if (missingFields.length > 0) {
        showMessage(`Please select ${missingFields.join(', ')} before confirming.`, 'error');
        return false;
    }

    showMessage('');
    return true;
}

function getBookingData() {
    return {
        bookingId: `SNIFR-${Date.now()}`,
        walker: 'Priyanka',
        pet: petSelect.value,
        duration: '60 Minute Walk',
        date: selectedDate,
        time: selectedTime,
        rate: 250,
        platformServiceFee: 30,
        totalCost: 280,
        currency: 'INR',
        status: 'confirmed',
        submittedAt: new Date().toISOString()
    };
}

function downloadBookingJson(booking) {
    const jsonFile = new Blob([JSON.stringify(booking, null, 2)], {
        type: 'application/json'
    });
    const fileUrl = URL.createObjectURL(jsonFile);
    const downloadLink = document.createElement('a');

    downloadLink.href = fileUrl;
    downloadLink.download = `snifr-booking-${booking.bookingId}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(fileUrl);
}

bookingForm.addEventListener('submit', event => {
    event.preventDefault();

    if (!validateBooking()) return;

    confirmationDetails.textContent =
        `${petSelect.value} with Priyanka on ${selectedDate} at ${selectedTime}. Total cost: ₹280.00.`;
    confirmationDialog.showModal();
});

submitBookingButton.addEventListener('click', event => {
    event.preventDefault();

    if (!validateBooking()) {
        confirmationDialog.close();
        return;
    }

    const booking = getBookingData();

    localStorage.setItem('snifrLatestBooking', JSON.stringify(booking));
    downloadBookingJson(booking);
    confirmationDialog.close();
    showMessage('Booking confirmed. Redirecting to your dashboard…', 'success');

    window.setTimeout(() => {
        window.location.href = 'Dashboard.HTML';
    }, 1000);
});

cancelBookingButton.addEventListener('click', () => {
    const shouldCancel = window.confirm('Cancel and clear your current booking selections?');
    if (!shouldCancel) return;

    selectedDate = '';
    selectedTime = '';
    petSelect.value = '';
    setSelectedButton(dateButtons, null);
    setSelectedButton(timeButtons, null);
    updateBookingSummary();
    showMessage('Booking selections cleared.', 'success');
});

// Start with no hidden assumptions so every required choice is validated.
setSelectedButton(dateButtons, null);
setSelectedButton(timeButtons, null);
petSelect.value = '';
updateBookingSummary();
