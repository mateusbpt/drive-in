# api

Node and Hono. Keeps the rooms, mints the tokens, decides who holds the stage and
runs the presence WebSocket. In production it also serves the frontend bundle,
from the same domain — which is why the project has no proxy of its own.

There is no database: each room is a Redis key with an expiry date.

## Running

Needs Redis and a reachable LiveKit.

```bash
pnpm infra:up    # from the root: brings up Redis and LiveKit
pnpm dev:api     # :3000
```

Variables live in `.env.example`, at the root. The development compose already
advertises `127.0.0.1` for LiveKit; with the public IP the media connection would
never complete, because the browser is on the same machine.

In development `WEB_ROOT` is empty and Vite serves the interface.

## Rooms

```bash
pnpm room:create        # creates one and prints the link
pnpm room:list          # open rooms
pnpm room:check         # consistency diagnosis
pnpm room:lock <token>  # refuses new arrivals
pnpm room:close <token> # ends it now
```

There is no HTTP route that creates a room. `room:check` compares the Redis
record, the stage lock and who is actually connected to the SFU, and reports any
disagreement between the three.

On a server the same commands run inside the container:

```bash
docker exec -it -w /app <container> pnpm room:create
```

## Routes

| Method | Route | |
|---|---|---|
| `GET` | `/api/health` | |
| `GET` | `/api/rooms/:token` | public room state, rate limited |
| `POST` | `/api/rooms/:token/join` | returns a session and a LiveKit JWT |
| `POST` | `/api/feature/set` | sets what is playing |
| `POST` | `/api/stage/take` | asks for the stage |
| `POST` | `/api/stage/release` | gives the stage back |
| `WS` | `/api/ws?session=` | presence and room state |

## The stage

The LiveKit JWT is minted with microphone permission only. Granting the stage
changes the participant's permission on the SFU through `updateParticipant`;
without the grant LiveKit refuses the screen track, so a client cannot publish on
its own initiative.

The grant uses `SET NX` in Redis. Reading the room, checking the stage is free and
writing afterwards would be a race two simultaneous requests could both win.

The stage is released when the participant leaves, when they end the share from
the browser's own button, and by a periodic sweep in case the disconnect never
arrives.

## Two URLs for the SFU

`LIVEKIT_URL` is the internal address, which the api uses to create rooms and
grant permissions. `LIVEKIT_PUBLIC_URL` is what goes out on `join` and the browser
dials, already over TLS. They differ on purpose — sending the internal address to
the browser makes the media connection fail with no clear error.

## DJ mode

A queue of YouTube links kept in the room record, in Redis. Every command goes
through the WebSocket that already exists — `dj:enter`, `dj:add`, `dj:remove`,
`dj:clear`, `dj:play`, `dj:toggle`, `dj:skip`, `dj:ended`, `dj:leave` — and the
state comes back in `session:state`, same as the stage.

The queue has no owner. What the server stores is not the track's current position
but when it started: each browser works out on its own which second to join at, so
whoever arrives mid-song needs nobody to tell them.

The track title comes from YouTube's oEmbed, which needs no key. Duration only
exists in the Data API, so the queue shows the duration of the current track only,
reported by the player of whoever is listening.

DJ mode and screen sharing are mutually exclusive: taking the screen turns the DJ
off, and turning the DJ on is refused while somebody holds the stage. In both
cases the track freezes where it was, so it can resume from there.
