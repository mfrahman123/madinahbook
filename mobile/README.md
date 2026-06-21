# al-wadih learning Mobile

This mobile app uses Capacitor to wrap the existing al-wadih learning web platform in native iOS and Android shells.

The mobile app intentionally reuses the same server, UI, auth, premium gating, vocabulary tester, admin tools, email verification, and progress APIs. That keeps web and mobile behaviour consistent.

## Local Development

Start the web/API app first:

```sh
npm run dev
```

The default Capacitor config points to:

```text
http://localhost:4173
```

That works for iOS simulator and local desktop checks. For Android emulator, use a host-reachable URL such as:

```text
http://10.0.2.2:4173
```

For a physical phone, deploy the app to HTTPS first and set `server.url` in `capacitor.config.json` to that hosted URL.

## Native Commands

Sync Capacitor:

```sh
npm run mobile:sync
```

Open iOS:

```sh
npm run mobile:ios
```

Open Android:

```sh
npm run mobile:android
```

## Production Notes

- Use an HTTPS `server.url`.
- Keep `COOKIE_SECURE=true` on the backend.
- Connect a real email provider for password reset and verification emails.
- Keep admin accounts restricted.
- Re-run `npm run mobile:sync` after changing `capacitor.config.json` or mobile shell assets.
