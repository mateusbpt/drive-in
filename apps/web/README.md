# web

React, Vite and Tailwind. The whole room: coming in, listening, talking, watching
the screen and taking the stage.

It has no image of its own: the build goes into the `api` image, which serves the
interface and the routes from the same domain.

## Running

Needs the `api` up on `:3000` — Vite forwards `/api` there.

```bash
pnpm dev      # :5173
```

Open the link `pnpm room:create` printed. With no token in the URL the app shows
nothing but a private-session notice.

> Microphone and screen capture require a secure context. They work on
> `localhost`; on `http://192.168.x.x` the browser blocks them.

## Screens

| Route | |
|---|---|
| `/` | private-session notice |
| `/s/#<token>` | entry, room, broadcast and fullscreen |

The token travels in the URL fragment, which the browser never sends to the server.

## Layout

```
src/
├── scenes/       Arrival, JoinRoom, Notice, ParkingLot, DjBooth, OnAir, FullscreenView
├── components/   the drive-in set, the screen, cars, controls
├── hooks/        useRoom (api), useLiveKit (SFU), useYouTube (DJ mode), fullscreen, sounds
├── strings.ts    every visible string, in both languages
└── theme.ts      palette and set constants
```

Interface strings live only in `strings.ts`. English by default; `VITE_LANG=pt-BR`
switches the whole interface.

## Media

Video comes from `getDisplayMedia`, published with simulcast off and a
`maintain-resolution` preference: in a film, blurring is worse than stuttering.

Movie audio and voice audio are separate tracks, with independent volume and one
control per person. The movie track skips echo cancellation, noise suppression and
automatic gain — those are voice filters, and they wreck a soundtrack.

Whoever is broadcasting sees their own preview, and it goes out muted: the audio
is already coming out of the speakers of the machine doing the sharing.

## DJ mode

The car dashboard enlarged, with the big screen out of frame — the same parking
lot scene, with the `viewBox` closed in. Inside it, two apps: the music, with the
player and the queue, and the room, with who is online.

The queue has no owner: anyone adds, removes, skips and pauses. The video does not
pass through LiveKit — each browser loads the same id in the YouTube player and
puts itself at the second the server dictates. Whoever arrives mid-song lands at
the right point with nobody telling them.

Music volume is per person and lives in the same control as the movie and the
voices. A transparent shield covers the player: clicking it would pause for
yourself alone and drop you out of step with the room.
