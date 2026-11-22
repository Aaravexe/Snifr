# Walker profile and availability

This implements the first four Person 3 tasks: onboarding, settings, availability, and the WalkerProfile/WalkerAvailability MongoDB models.

Run `npm start`, open `http://localhost:3000/authpage.html?role=walker`, and create or sign in to a walker account. Walker authentication opens onboarding; an already completed browser draft opens settings. The dashboard profile button also opens walker settings for walker accounts.

## Implemented

- Four onboarding steps: biography and experience, services and rate, service area and photo, then review.
- Per-step validation, accessible field errors, focus handling, draft saving and resuming, and an unsaved-change warning.
- Settings for name, biography, experience, hourly rate, services, neighbourhood, city, PIN code and photo, with save and discard actions.
- JPG/PNG/WebP checks, a 2 MB upload limit, image decoding, and a resized local preview.
- Drafts separated by the current account ID. Existing sample walkers prefill their available name, biography, rate and image from `walkers.json`.
- Responsive pages styled to match Snifr.
- Availability calendar with date and time-slot create/read/update/delete, date moves, delete confirmations, and account-specific draft persistence.
- Shared validation for India time, real calendar dates, future starts, same-day intervals, adjacent slots, overlap rejection, and booked-slot protection.
- Mongoose models in `server/models/`, plus the `mongoose` dependency and npm lockfile.

## Current persistence boundary

The current checkout has MongoDB model definitions but no WalkerProfile/availability API, database connection, or authenticated server session. `walker-profile.js` stores **browser drafts**, using `snifrWalkerDraft:v1:<accountId>`. Availability drafts use `snifrWalkerAvailability:v1:<accountId>`. The pages explicitly say this. Completing a draft does not publish a walker, update `walkers.json`, or change search/booking prices. The browser role gate is navigation only; it is not server authorization. Booked-slot guards are implemented and tested, but live bookings are not yet imported into availability.

The separate Express/MongoDB connection, CRUD endpoints, publishing, search, and location API tasks from the team document remain for the next stage. Browser drafts are not the final database implementation required by that document.

## Integration handoff

Replace `WalkerProfile.initial` / `load` / `save` in `walker-profile.js` with authenticated server reads and writes when the walker endpoints are available. Make save callers await those writes. Use the agreed `{ success, data, message }` response shape, enforce ownership and repeat validation on the server, then use the server's profile-completion status for redirects. Use server-owned identity rather than trusting `snifrSession`.

Draft profile fields are `name`, `about`, `experience` (whole years), `hourlyRate` (INR per hour), `services` (`walking`, `sitting`, `drop-in`), `area`, `city`, `pincode`, and `image` (compressed data URL or existing local asset). Form numbers are stored as strings to preserve blank drafts; convert validated values to numbers in the API adapter. Name, biography, rate, and image retain the existing walker-data field names. Confirm the new fields with the backend owner before adding the schema. Upload images to server storage and persist the returned image URL in the final implementation.

The changes outside Person 3's pages/helpers include the walker destinations in `authpage.js` and `dashboard.js`, the Mongoose dependency and test script in `package.json`, and blocking access to server source/dependencies/tests in the existing static server. Owner destinations, existing search and booking behavior are unchanged.

## MongoDB model contract

`WalkerProfile` has a unique `userId` ObjectId referencing the future `User` model, the profile fields above, `status` (`draft` or `published`), rating/review/walk counters, timestamps, and a computed `profileComplete` virtual. Incomplete registration markers are allowed in draft status. Supplied values are validated even in drafts. Required fields and a nonempty service selection are enforced for published profiles. Call `await profile.publish()` to validate a status change, then `await profile.save()` to persist it. `publish()` alone does not write to MongoDB or add availability.

`WalkerAvailability` stores one document per `{ walkerId, date }`, protected by a compound unique index. `walkerId` references `WalkerProfile`; `date` is a local `YYYY-MM-DD` string, and `timezone` is always `Asia/Kolkata`. Each embedded slot has its own ObjectId, `startTime` / `endTime` (`HH:mm`), `status` (`available` / `booked`) and nullable `bookingId` referencing the future `Booking` model. Booked slots require a booking ID; available slots must not have one. Empty dates are allowed while planning but must not appear as bookable search results.

Available document methods are `addSlot(startTime, endTime)`, `updateSlot(slotId, startTime, endTime)`, `removeSlot(slotId)`, `moveToDate(date)` and `assertCanDelete()`. These methods do not persist; call `await document.save()` afterward, or `await document.deleteOne()` after authorizing deletion. Saving a loaded document also rejects direct removal/movement of its booked slots. Existing historical records can still be read and validated; new or changed past slots cannot be saved.

Both models use optimistic concurrency. Load a document, authorize the walker, apply a whitelisted change, and save it. Use document saves, not raw `updateOne`, `findOneAndUpdate`, `bulkWrite` or query deletes: those bypass the cross-field/document guards. Booking controllers must own booking-state transitions and enforce authorization, booking existence and transactional conflict handling. Do not allow walker form payloads to set `bookingId`, booked status, ratings, counters, ownership, or publication status directly. Cancel a booking and release its slot before moving/deleting it. Document references do not check whether the referenced records exist.

When connecting MongoDB, initialize the indexes (`await Model.init()` after connecting). Handle duplicate keys as conflicts (HTTP 409); a declared unique index is not a Mongoose validator. Catch optimistic-concurrency errors similarly. Do not reuse demo string account IDs as MongoDB ObjectIds; use the authenticated User/WalkerProfile IDs from the future backend. Translate the browser slot `id` to the embedded MongoDB `_id`. For partial profile drafts, omit blank optional values; convert validated number fields before saving.

The implementation follows Mongoose's [validation](https://mongoosejs.com/docs/validation.html) and [document middleware](https://mongoosejs.com/docs/middleware.html) guidance. Automated model tests validate documents in memory; they do not claim a running MongoDB connection or prove database index enforcement.

## Manual checks

Run `npm install` after pulling this change, then `npm test` for the profile, availability and model checks. Run `npm start` for the pages.

1. Open either new page without a walker session: sign-in links appear and the editor is hidden.
2. Sign in as a walker; attempt to continue with missing/invalid fields. Errors should focus the first invalid field.
3. Save a partial draft and reload. Complete all four steps with a valid image; settings should show the same data.
4. Edit every settings section, save and reload. Discard a later edit and confirm that saved data returns.
5. Try an unsupported image, an image over 2 MB and invalid image contents. Saving must not silently accept the failed upload.
6. Use another walker account: its draft must be separate. An owner account must not see the walker editor.
7. Check the forms at mobile and desktop widths with keyboard navigation.
8. Open Availability from Walker Settings, add a future date, add two adjacent slots, edit a slot, move the date, and reload. The saved schedule should remain.
9. Try a duplicate date, overlapping slot, reversed interval, past date and past time today. Each must fail without changing the saved draft.
10. Delete a slot or date using the confirmation dialog. Cancel first to confirm nothing changes, then confirm deletion.
11. Open two tabs and change a schedule in one. A stale save in the second must reload the latest schedule instead of overwriting it.
