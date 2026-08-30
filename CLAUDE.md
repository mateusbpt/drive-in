# CLAUDE.md — Drive-In & Popcorn

A private drive-in for a closed group of friends. One person shares their screen,
everyone watches together and talks over voice. It runs in the browser.

`README.md` covers what the project is and how to run it. This file covers how to
work inside it.

---

## Scope

This is an app for about six friends, not a product. The default question in
front of any decision is "is this simple enough?", not "does this scale?".

**Do not add without being asked:** text chat, webcam, recording, a mobile
client, sign-up, login of any kind, OAuth, an admin panel, metrics, load tests,
a packaged desktop client, or a dependency on any third-party service.

That last one is the load-bearing part of the open version: cloning this repo
must not require an account anywhere. The two secrets in `.env` are generated
locally, and everything else runs in Docker. If a task seems to need a hosted
API, stop and ask first.

---

## Stack

| Layer | Technology |
|---|---|
| Client | Web app in the browser — React, TypeScript, Vite, Tailwind |
| Icons | react-icons, Lucide family (`react-icons/lu`) |
| Media SDK | LiveKit Components React |
| Backend | Node and TypeScript, Hono |
| State | Redis — rooms with a TTL. **There is no relational database.** |
| Media | LiveKit Server (SFU) |
| Screen capture | `getDisplayMedia`, in the browser |

Tailwind 4 has no `tailwind.config.js`: the tokens live in an `@theme` block in
`src/index.css`, and the plugin is `@tailwindcss/vite`.

### Versions

**Never pin a version from memory.** Before writing any `package.json` or Docker
image tag, look up the current stable version at the ecosystem's own source
(`npm view <pkg> version`, Docker Hub). List the versions you chose before
writing the manifest.

---

## Layout

```
drive-in/
├── apps/
│   ├── web/              # React and Vite: the whole room
│   └── api/              # Node: tokens, stage control, WebSocket, CLI
├── packages/
│   └── shared/           # shared types and contracts
└── infra/
    ├── docker-compose.yml       # Redis and LiveKit, for development
    └── livekit/                 # the production LiveKit, as a Compose service
```

Message types exchanged between `api` and `web` live in `packages/shared`. Never
duplicate an interface across the two sides — if both need it, it belongs in
shared.

---

## Language

- **Code, identifiers, filenames and types: English.**
- **Comments: English.** A comment exists to explain *why* something is the way
  it is. If it only restates what the line already says, delete it.
- **Interface: English by default, Brazilian Portuguese behind `VITE_LANG=pt-BR`.**
- **Commit messages: English**, conventional commits (`feat:`, `fix:`,
  `refactor:`).

UI strings are centralised in `apps/web/src/strings.ts`, never inline in JSX. The
two translations sit side by side in that file; a third means one more object,
not an i18n library.

---

## Non-negotiable constraints

These exist for concrete reasons. Breaking them breaks the app in ways that are
hard to diagnose.

**A room is born from the CLI, never from an HTTP route.** `pnpm room:create` is
the only door. There is no endpoint that creates rooms, so a leaked link can
never become a room factory.

**The link is the credential.** High-entropy token, room with a TTL, and the room
can be locked to stop taking new people. The join route is rate limited anyway,
even though the entropy already makes guessing hopeless.

**Whoever enters a room has no account, no login and no password.** No sign-up,
no passkey, no OAuth. If something seems to need authenticating a viewer, stop
and ask — the design is probably wrong.

**There is no database.** A room is a Redis key with an expiry date. There is no
history of what was watched, no profile, and no name kept between sessions — you
type a name on the way in and it dies with the room. If something needs to
genuinely persist, stop and ask before introducing a database.

**Stage state lives only in the `api`.** The client never decides who may
broadcast. It asks, the server grants. Every publish permission is reflected in
the LiveKit JWT and validated server-side.

**Granting the stage means changing the permission on the SFU, not the token.**
The JWT is minted able to publish microphone only; whoever receives the stage
gets `screen_share` added through `updateParticipant`. The client can ask as much
as it likes — without the grant, LiveKit itself refuses the track. Permissions
are atomic: always send the whole set.

**The LiveKit room must exist before anyone joins.** With `auto_create: false`,
connecting to a room that does not exist returns 404 and the WebSocket never
opens. `CreateRoom` happens on join, not when the stage changes hands.

**Stopping the share from the browser's own button must release the stage.** That
button does not go through our interface. Without listening for
`LocalTrackUnpublished`, the stage stays stuck for the whole room.

**Fullscreen uses the browser Fullscreen API**, called from inside a user
gesture. The cursor is hidden with CSS.

**Movie audio and voice audio are separate tracks.** The movie track is published
with no echo cancellation, no noise suppression and no automatic gain — those
filters destroy a soundtrack. Never apply voice constraints to a media track.

**Simulcast off, `maintain-resolution`.** We would rather freeze than blur: in a
film, resolution matters more than smoothness. A bad connection stutters.

**DJ mode music does not pass through our SFU.** The server keeps the queue and
says which track is playing and since when; each browser loads the same id in the
YouTube player and puts itself at the same second. That is why the CSP opens
`script-src` and `frame-src` to their domain. Relaying the audio through LiveKit
would cost bandwidth and go against the terms of whoever serves the video.

**DJ mode and the big screen are mutually exclusive.** It is the same mechanism
as the stage: one more piece of room state, decided by the server. The client
asks, never decides.

---

## Commands

```bash
pnpm dev              # frontend, watching
pnpm dev:api          # api, watching
pnpm typecheck        # required before considering a task done
pnpm build
pnpm infra:up         # Redis and LiveKit
pnpm room:create      # creates a room and prints the link
```

Run `pnpm typecheck` before saying you are finished. A change is not complete
with a type error outstanding.

---

## Working here

- Present a plan and wait for confirmation before large tasks.
- Prefer a few well-organised files over many small ones.
- Do not add a dependency without justifying why the standard library will not do.
- When a decision documented here stops making sense in practice, say so — do not
  quietly work around it.
