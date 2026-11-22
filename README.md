# Snifr

Snifr is a full-stack dog-walking web application built with vanilla HTML, CSS and JavaScript, an Express server, Mongoose, and MongoDB Atlas.

Consumers can manage pets, search for walkers, book walks, manage bookings, and review completed walks. Walkers have separate onboarding, profile, availability, booking-request, settings, and dashboard flows. Administrators can inspect and manage the main application records.

## Technology

- Frontend: HTML5, CSS3 and vanilla JavaScript
- Backend: Node.js and Express 5
- Database: MongoDB Atlas through Mongoose
- Authentication: server-side password hashing and HttpOnly session cookies
- Local files: JSON booking backups and approved demonstration data only
- Hosting: Render Web Service with MongoDB Atlas

## Requirements

- Node.js 22
- npm
- Git
- MongoDB Atlas account and deployment

Check installed versions:

```powershell
node --version
npm --version
git --version
```

## Project structure

```text
public/
  assets/              Images and SVGs
  css/                 Page stylesheets
  js/                  Browser JavaScript
  *.html               Browser pages
server/
  config/              Atlas/Mongoose configuration
  controllers/         Feature logic
  data/                Approved seed/demo JSON
  middleware/          Sessions, roles, errors and logging
  models/              Mongoose schemas
  routes/              Express page and API routes
  services/            JSON backup and shared services
tests/                  Node test suite
docs/                   Setup documentation
server.js               Application entry point
render.yaml             Render deployment configuration
```

Only `public/` is exposed by `express.static`. Server code, `.env`, tests, seed files, account data, and booking backups are not public.

## Frontend design system

The responsive frontend follows the supplied Figma screens for the landing page, authentication, consumer dashboard, walker search, walker profile/booking, and shared footers. Reusable colours, typography, account menus, and footer rules live in `public/css/theme.css`; each page keeps its own layout stylesheet and JavaScript file. The remaining account, Walker, booking, support, and admin pages use the same cream, peach, olive, brown, Figtree, and Outfit visual language.

## First-time setup

```powershell
cd "C:\Users\shubh\OneDrive\Desktop\UNISEM3\WEBDEV JS\Figma\Snifr"
npm install
Copy-Item .env.example .env
```

Do not overwrite an existing `.env` that already contains the Atlas connection string.

Configure `.env`:

```env
PORT=3000
HOST=0.0.0.0
MONGODB_URI=mongodb+srv://USERNAME:ENCODED_PASSWORD@CLUSTER.mongodb.net/snifr?retryWrites=true&w=majority&appName=Snifr
MONGO_REQUIRED=true
MONGODB_ATLAS_ONLY=true
```

The real `.env` is ignored by Git. Never commit the Atlas URI, database password, generated admin password, or session data.

Complete Atlas instructions are in [docs/MONGODB-ATLAS-SETUP.md](docs/MONGODB-ATLAS-SETUP.md).

## Important development commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm ci` | Clean dependency installation for CI/hosting |
| `npm start` | Start the production-style Express server |
| `npm run dev` | Start Node in watch mode during development |
| `npm test` | Run the complete local test suite |
| `npm run db:check` | Verify Atlas and list its collections |
| `npm run db:seed -- "DemoPassword123"` | Create/update demonstration Consumer, Walker, pet and availability records |
| `npm run admin:create -- admin@example.com` | Create an administrator and print a generated password |

After starting the server, open:

```text
http://localhost:3000
http://localhost:3000/health
```

Stop the server with `Ctrl+C`.

## Atlas setup summary

1. Create a MongoDB Atlas project and deployment.
2. Create a dedicated database user such as `snifr_app`.
3. Add the development computer's public IP under **Network Access**.
4. Open **Connect > Drivers > Node.js** and copy the `mongodb+srv://` URI.
5. Add `/snifr` before the URI query string.
6. Percent-encode reserved characters in the database password.
7. Save the complete URI as `MONGODB_URI` in `.env`.
8. Run `npm run db:check` before seeding or starting Snifr.

## Testing

Run tests that do not require a live database:

```powershell
npm test
```

Run the MongoDB integration tests against a disposable Atlas test database:

```powershell
$env:SNIFR_TEST_MONGO_URI="mongodb+srv://USERNAME:ENCODED_PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority"
npm test
Remove-Item Env:SNIFR_TEST_MONGO_URI
```

Never point integration tests at production data. The integration tests create and drop temporary databases.

## Main routes

| Page | Route |
| --- | --- |
| Landing page | `/` |
| Sign in / registration | `/auth` |
| Walker search | `/walkers` |
| Walker information and booking | `/walker/:walkerId` |
| Consumer dashboard | `/consumer-dashboard` |
| Consumer settings | `/consumer-settings` |
| Consumer bookings | `/my-bookings` |
| Walker dashboard | `/walker-dashboard` |
| Walker onboarding | `/walker-onboarding` |
| Walker settings | `/walker-settings` |
| Walker availability | `/walker-availability` |
| Walker booking requests | `/walker-bookings` |
| Admin dashboard | `/admin` |
| Support | `/support` |
| Server/database health | `/health` |

## Main API groups

- `/api/auth` - registration, login, logout, password and account actions
- `/api/users` - administrator user CRUD
- `/api/consumer-profiles` - Consumer profile CRUD
- `/api/walkers` - Walker profile, filtering and availability CRUD
- `/api/bookings` - Consumer and Walker booking workflow
- `/api/pets` - pet CRUD
- `/api/reviews` - review CRUD and Walker rating synchronization
- `/api/feedback` - support feedback CRUD
- `/api/local` - required approved local-JSON demonstration endpoints

API responses use:

```json
{
  "success": true,
  "data": {},
  "message": "Readable result message"
}
```

## Git commands

Before committing:

```powershell
git status
git diff --check
npm test
```

Commit and push:

```powershell
git add -A
git commit -m "Finalize Snifr frontend and Atlas deployment"
git push origin main
```

Do not use `git add -f .env` and do not commit generated booking/account folders.

## Deploy on Render

The repository includes `render.yaml`. Render must run Snifr as a **Web Service**, not as a static site, because Express provides routing, authentication, APIs, and Atlas access.

### Dashboard deployment

1. Push the repository to GitHub.
2. Sign in at `https://dashboard.render.com`.
3. Select **New > Blueprint** and choose the repository containing `render.yaml`.
4. Confirm the `snifr` Web Service.
5. Add the secret environment variable `MONGODB_URI` with the complete Atlas connection string.
6. Keep `MONGO_REQUIRED=true` and `MONGODB_ATLAS_ONLY=true`.
7. Deploy and inspect the Render logs.
8. Set the Render health-check path to `/health` if it was not imported from the Blueprint.

Equivalent manual service settings:

```text
Runtime: Node
Build command: npm ci
Start command: npm start
Health check: /health
```

Render supplies `PORT`. `server.js` listens on `0.0.0.0` and uses that environment-provided port.

### Atlas network access for hosting

Atlas must allow connection attempts from the deployed Express server. Prefer adding the hosting service's documented outbound IP range when available. If a free/dynamic service does not provide a stable outbound IP and `0.0.0.0/0` is temporarily used, protect the database with a strong unique database-user password and minimum required privileges.

### Verify the deployment

```text
https://YOUR-SERVICE.onrender.com/
https://YOUR-SERVICE.onrender.com/health
```

The health response must report `mongodb.connected: true` and database `snifr`.

## Common deployment problems

| Problem | Fix |
| --- | --- |
| `Set the MongoDB Atlas MONGODB_URI in .env` | Add `MONGODB_URI` in the local `.env` or Render environment settings |
| `bad auth` | Use the Atlas database user, verify the password, and percent-encode reserved characters |
| `IP not in access list` | Add the development or hosting server IP under Atlas Network Access |
| `querySrv ENOTFOUND` | Recopy the complete `mongodb+srv://` hostname and check DNS/network access |
| `Server selection timed out` | Check Atlas deployment status, Network Access, firewall, and credentials |
| Render reports no open port | Keep `HOST=0.0.0.0` and use Render's `PORT` variable |
| Database is named `test` | Add `/snifr` before `?` in the Atlas URI |
| Page returns 404 after restructuring | Use the clean routes listed above and run `npm test` to check local links |

## Production notes

- Use HTTPS in production; Render provides TLS for its public service URL.
- Use separate Atlas users and databases for development, testing, and production.
- Rotate database credentials if they are ever exposed.
- Restrict the Atlas database user's privileges.
- Do not use the in-memory session implementation for a large multi-instance production deployment; replace it with a shared persistent session store before scaling horizontally.
- Review generated booking backups because a cloud host's local filesystem can be ephemeral. Store required permanent backups in managed object storage for a real production release.

demo.walker@snifr.local
demo.consumer@snifr.local
admin@example.com olMpb5cJt3EhnR16OEdoxCWXmXM