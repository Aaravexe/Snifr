# Snifr MongoDB Atlas setup

Snifr connects from the Express server to MongoDB Atlas through Mongoose and the official MongoDB driver protocol. Browser code never receives the Atlas URI or database password.

## 1. Create the Atlas deployment

1. Sign in at `https://cloud.mongodb.com/`.
2. Create a project named **Snifr**.
3. Select **Create a deployment** and choose the free `M0` tier if it is available.
4. Choose a nearby region and name the deployment, for example `SnifrCluster`.
5. Wait until the deployment is ready.

## 2. Create a database user

1. Open **Security > Database Access**.
2. Select **Add New Database User**.
3. Choose password authentication.
4. Use a dedicated username such as `snifr_app`; do not use your Atlas website password.
5. Generate a strong password and store it privately.
6. Give the user **Read and write to any database** for the student project, or restrict it to the `snifr` database if Atlas offers that option.

If the username or password contains reserved URI characters such as `@`, `:`, `/`, `?`, `#`, `%`, or a space, percent-encode it before placing it in the URI. In a browser console or Node.js, `encodeURIComponent('your password')` returns the encoded value.

## 3. Allow the application IP

1. Open **Security > Network Access**.
2. Select **Add IP Address**.
3. For development, select **Add Current IP Address**.
4. Add the IP address of every computer that will run the Express server.

Avoid `0.0.0.0/0` for a final deployment because it permits connection attempts from every IP. If a hosting provider uses changing outbound addresses, temporarily allowing all IPs is possible, but the database user must have a strong unique password.

## 4. Copy the application connection string

1. Open **Database > Clusters**.
2. Select **Connect** on `SnifrCluster`.
3. Choose **Drivers**.
4. Select **Node.js** and copy the SRV string beginning with `mongodb+srv://`.
5. Replace `<password>` with the encoded database-user password.
6. Put `/snifr` before the query string so Snifr uses the correct database.

Example shape only:

```env
MONGODB_URI=mongodb+srv://snifr_app:ENCODED_PASSWORD@cluster-host.mongodb.net/snifr?retryWrites=true&w=majority&appName=Snifr
```

Never commit the real connection string. `.env` is ignored by Git.

## 5. Configure `.env`

```env
PORT=3000
MONGODB_URI=PASTE_THE_COMPLETE_ATLAS_URI_HERE
MONGO_REQUIRED=true
MONGODB_ATLAS_ONLY=true
```

`MONGO_REQUIRED=true` prevents the final website from silently running without its database. `MONGODB_ATLAS_ONLY=true` rejects local `mongodb://127.0.0.1` connections.

## 6. Verify Atlas and create demo records

From the project root:

```powershell
npm install
npm run db:check
npm run db:seed -- "ChooseADemoLoginPassword"
```

The first command verifies the Atlas connection and lists collections. The seed command creates one Consumer, one Walker, one pet, a published Walker profile, and future availability. The seed is idempotent.

## 7. Start Snifr

```powershell
npm start
```

Open `http://localhost:3000` and inspect `http://localhost:3000/health`. A successful health response reports `mongodb.connected: true` and database `snifr`.

## 8. Create an administrator

```powershell
npm run admin:create -- admin@example.com
```

Store the generated password privately, then sign in through `/auth`.

## 9. Main Express APIs backed by Atlas

- Authentication: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- Users: `/api/users`
- Consumer profiles: `/api/consumer-profiles/:userId`
- Walkers and availability: `/api/walkers`, `/api/walkers/:id/availability`
- Bookings: `/api/bookings`
- Pets: `/api/pets`
- Reviews: `/api/reviews`
- Feedback CRUD: `/api/feedback`

The frontend calls these Express APIs. Express uses Mongoose to perform MongoDB CRUD in Atlas. The Atlas URI stays on the server.

## Troubleshooting

- `bad auth`: the database username/password is wrong, the password was not percent-encoded, or an Atlas account password was used instead of a database-user password.
- `IP not in access list`: add the Express server's current public IP under Network Access.
- `querySrv ENOTFOUND`: the cluster hostname is incomplete or DNS/network access is blocked.
- `Server selection timed out`: check deployment status, IP access, firewall, and the complete URI.
- Database name is `test`: add `/snifr` between `.mongodb.net` and `?` in the URI.
