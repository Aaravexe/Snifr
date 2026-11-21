# Person 1 - Express Foundation

## What this module owns

- Express startup and static-page serving.
- `.env` loading and optional MongoDB connection setup.
- Shared JSON body parsing, request logging, 404 handling and central API error handling.
- Safe local JSON helpers and the feedback demonstration API.
- Landing-page route aliases, Support page and custom 404 page.
- Compatibility wiring for the already existing account/booking routes. Their feature owners will replace these routes with their final role-aware MongoDB modules later.

## Start the project

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

MongoDB is optional for the foundation to start. To connect it, copy `.env.example` to `.env` and set `MONGODB_URI`.

## Person 1 routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/auth` | Authentication page alias |
| `/dashboard` | Dashboard page alias |
| `/walkers` | Walker Search page alias |
| `/walker/:walkerId` | Redirects to the existing Walker Information page |
| `/support` | Feedback page demonstrating local JSON write |
| `/health` | Server health JSON response |
| `GET /api/local/walkers` | Reads root `walkers.json` through Express |
| `GET /api/local/feedback` | Reads locally saved feedback records |
| `POST /api/local/feedback` | Validates and saves one feedback record to `server/data/feedback.json` |

`server/data/*.json`, `.env`, generated accounts and generated bookings are ignored by Git. Files inside server code, tests, node_modules and generated private folders are blocked from static download.

## Shared integration rule

Feature owners must add their own Express routers through `server/app.js`; they should not replace Person 1 middleware, static-file protection, error handling or MongoDB bootstrap. API responses should use:

```json
{ "success": true, "data": {}, "message": "..." }
```

or:

```json
{ "success": false, "data": null, "message": "..." }
```
