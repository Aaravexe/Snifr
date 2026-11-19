# Walker onboarding and settings

This implements the first two Person 3 tasks in the existing HTML/CSS/JS project.

Run `npm start`, open `http://localhost:3000/authpage.html?role=walker`, and create or sign in to a walker account. Walker authentication opens onboarding; an already completed browser draft opens settings. The dashboard profile button also opens walker settings for walker accounts.

## Implemented

- Four onboarding steps: biography and experience, services and rate, service area and photo, then review.
- Per-step validation, accessible field errors, focus handling, draft saving and resuming, and an unsaved-change warning.
- Settings for name, biography, experience, hourly rate, services, neighbourhood, city, PIN code and photo, with save and discard actions.
- JPG/PNG/WebP checks, a 2 MB upload limit, image decoding, and a resized local preview.
- Drafts separated by the current account ID. Existing sample walkers prefill their available name, biography, rate and image from `walkers.json`.
- Responsive pages styled to match Snifr. No new dependencies.

## Current persistence boundary

The current checkout has no WalkerProfile API, database models, or authenticated server session. `walker-profile.js` stores **browser drafts**, using `snifrWalkerDraft:v1:<accountId>`. The pages explicitly say this. Completing a draft does not publish a walker, update `walkers.json`, or change search/booking prices. The browser role gate is navigation only; it is not server authorization.

The separate Express/MongoDB, availability, publishing, search, and location API tasks from the team document remain for the next stage. Browser drafts are not the final database implementation required by that document.

## Integration handoff

Replace `WalkerProfile.initial` / `load` / `save` in `walker-profile.js` with authenticated server reads and writes when the walker endpoints are available. Make save callers await those writes. Use the agreed `{ success, data, message }` response shape, enforce ownership and repeat validation on the server, then use the server's profile-completion status for redirects. Use server-owned identity rather than trusting `snifrSession`.

Draft profile fields are `name`, `about`, `experience` (whole years), `hourlyRate` (INR per hour), `services` (`walking`, `sitting`, `drop-in`), `area`, `city`, `pincode`, and `image` (compressed data URL or existing local asset). Form numbers are stored as strings to preserve blank drafts; convert validated values to numbers in the API adapter. Name, biography, rate, and image retain the existing walker-data field names. Confirm the new fields with the backend owner before adding the schema. Upload images to server storage and persist the returned image URL in the final implementation.

The only changes outside Person 3's new pages/helper are the walker destination in `authpage.js` and the walker profile-button destination in `dashboard.js`. Owner destinations, existing search and booking behavior are unchanged.

## Manual checks

Run the automated validation/storage checks with `node --test tests/walker-profile.test.js`.

1. Open either new page without a walker session: sign-in links appear and the editor is hidden.
2. Sign in as a walker; attempt to continue with missing/invalid fields. Errors should focus the first invalid field.
3. Save a partial draft and reload. Complete all four steps with a valid image; settings should show the same data.
4. Edit every settings section, save and reload. Discard a later edit and confirm that saved data returns.
5. Try an unsupported image, an image over 2 MB and invalid image contents. Saving must not silently accept the failed upload.
6. Use another walker account: its draft must be separate. An owner account must not see the walker editor.
7. Check the forms at mobile and desktop widths with keyboard navigation.
