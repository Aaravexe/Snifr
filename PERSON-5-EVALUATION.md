# Snifr Person 5 evaluation

## Run the application

Use the team's Node.js project with a local MongoDB server or Atlas database. From the repository root, install the locked dependencies with `npm ci`. Copy `.env.example` to `.env` if you have not already configured it. Set `MONGODB_URI` to your evaluation database and run `npm start`. Open [Snifr](http://localhost:3000). The server logs the connected database name.

For the Admin demonstration, run `node server/createAdmin.js your-email@example.com` once against that database. The command prints a generated password and requires an unused email. Sign in through the regular authentication page. Keep the generated password private. Sign in again after restarting Express because the evaluation server keeps sessions in memory.

## Live demonstration

Use separate browser profiles for the Consumer, Walker and Admin so each has its own session cookie.

1. Register a Walker. Complete onboarding, publish the profile and open Availability. Add a future date and a slot from 09:00 to 10:00 India time. Return to the Walker dashboard to show the published profile and available date.
2. Register a Consumer. Open the Consumer dashboard, add a pet and edit its age. If the browser has pets from the previous Snifr dashboard, select **Import pet** for each pet belonging to this account. The old list was shared across accounts, so the owner chooses which records to claim.
3. Open the published Walker from Recommended walkers. Choose the saved pet, the available date and time, and confirm. Show the booking in the Consumer dashboard and the request in the Walker dashboard. Accept the request, show the upcoming walk, then mark the demonstration walk completed.
4. Open the Consumer booking history. Write a 4.5-star review, change it to 5 stars, then delete it. Refresh the walker listing after each change and show the rating and review count. For a walker with no other reviews, the count returns to zero.
5. Open Admin. Create a spare Walker user, create a Walker profile for that user, add availability, add a pet for a Consumer, create a booking, mark it completed, and add a review. Edit a field on each tab. Remove the review, booking, availability, pet, walker and spare account to demonstrate deletion in dependency order.
6. Sign out and open `/admin`. Show the sign-in redirect. Open an unknown page to show the custom 404. A Consumer opening the Walker dashboard is redirected to their own dashboard.

## Verification and bug checklist

| Check | Evidence |
| --- | --- |
| Both roles see their own data | Separate Consumer, Walker and unrelated Consumer sessions exercised through Express. Cross-account pet and review changes are denied. |
| Pets persist and import safely | MongoDB create, read, update and delete passed. Submitting the same import twice produced one pet. Active bookings prevent deletion. |
| Reviews follow completed walks | Incomplete and unrelated bookings, duplicate reviews and a 4.2-star rating were rejected. Two concurrent reviews of 3.5 and 5 produced a 4.25 average and a count of two. Deleting both reset the summary. |
| Admin manages every collection | Chrome created, read, edited and deleted Users, Walkers, Availability, Bookings, Pets and Reviews through the visible forms. |
| Booking pages use saved pets and real availability | A browser registered and published a walker, created a slot, booked it with a saved pet, accepted the request and completed the walk. |
| Loading, empty and failure states | Dashboard panels display loading messages and replace them with records or empty states. Browser checks confirmed an API failure showed its message and Retry restored the pet list. |
| Navigation and responsive layout | All local HTML links, asset paths and fragment targets passed the link test. A broken account-help anchor was repaired. Chrome at 1280 px and Edge at 375 px passed dashboard interaction and horizontal-overflow checks. |
| Database configurations | The integration suite passed on standalone MongoDB and a replica set. Replica sets commit review and rating writes together. Standalone MongoDB uses version-checked rating updates and reconciles interrupted updates after reconnect. |

## Repeat the checks

`npm test` runs the project tests. Set `SNIFR_TEST_MONGO_URI` to a test MongoDB connection to include the live integration journey. The test creates and removes its own uniquely named database. The existing booking controller also writes its local JSON backups under the project directory, so run QA from an evaluation checkout.

To include UI checks, make Playwright available to Node, install Chrome and Edge, set `SNIFR_BROWSER_QA=1`, and run the same tests. The helper uses the installed `chrome` and `msedge` channels. No test accounts or live credentials are included in Git.

## Team integration

The source revision contained the Express foundation, booking controller, WalkerProfile and WalkerAvailability models, plus browser-based onboarding and availability editors. User, Walker and Availability CRUD routes were missing. The Admin page uses the canonical `/api/users`, `/api/walkers`, nested availability, booking, pet and review routes. The existing booking controller serves both dashboards and Admin. Public registration grants Consumer or Walker access. An authenticated server session supplies ownership and roles for protected requests.
