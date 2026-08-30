# infra

| File | |
|---|---|
| `docker-compose.yml` | Redis and LiveKit for development. The `api` and Vite run outside it. |
| `livekit/docker-compose.yml` | LiveKit for production, as its own Compose stack. |

## Deploying

There are three moving parts: Redis, LiveKit, and the app image (which contains
both the API and the frontend bundle it serves). How you orchestrate them is up
to you — the notes below are the things that cost real time to discover, and they
apply wherever you run it.

### Build one image, serve one origin

`apps/api/Dockerfile` builds the frontend and copies it into the API image, which
serves it from `WEB_ROOT`. The browser talks to a single origin on port `3000`,
so there is no CORS and the presence WebSocket is same-origin. Put your
TLS-terminating proxy in front of that one port.

### Environment

```
PORT=3000
REDIS_URL=redis://:<password>@<redis-host>:6379
LIVEKIT_URL=ws://<livekit-host>:7880
LIVEKIT_PUBLIC_URL=wss://<livekit-domain>
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
PUBLIC_BASE_URL=https://<app-domain>
SESSION_SECRET=<openssl rand -base64 32>
ROOM_TTL_HOURS=16
ROOM_EMPTY_MIN=5
```

The two LiveKit URLs differ on purpose. `LIVEKIT_URL` is the internal name,
reachable only inside your container network; `LIVEKIT_PUBLIC_URL` is what the
API hands back on join and the browser actually dials. Sending the internal
address to the browser makes the media connection fail with no clear error.

### A port range, not a single port

LiveKit accepts either `rtc.udp_port` (one port, multiplexed) or
`rtc.port_range_start` and `rtc.port_range_end` (one port per connection).
**Use the range.** With a single port the socket opens, the port shows as
published, and still no packet from the browser reaches the ICE agent. An
ordinary socket on the same port — TURN's — received traffic normally, which
rules out both the network and the port publishing as the cause.

In the browser the symptom is `could not establish pc connection`, and on the
server:

```
"state": "failed", "requestsSent": 8, "responsesReceived": 0, "requestsReceived": 0
```

Beware of orchestrators that publish UDP ranges unreliably. Docker Swarm
published only one of the three requested UDP ports: `7882/udp` answered ICMP
port unreachable — exactly like a port with nothing behind it — while the
dashboard listed all three as configured. That is why LiveKit here is a plain
Compose stack rather than a Swarm service.

### `auto_create: false` is not a detail

With it turned on, connecting to a room name that does not exist creates it on
the SFU, and the rule that rooms are born from the CLI stops holding.

### The advertised IP

`use_external_ip: true` discovers the address over STUN and, on a host with more
than one interface, advertises the private network alongside the public one. The
browser tries that candidate, fails, and only then falls back to the public one.
Pinning it fixes the delay:

```
"rtc": {"use_external_ip": false, "node_ip": "<public-ip>"}
```

### The host UDP buffer

LiveKit warns at boot if the receive buffer is too small. At 1080p it overflows
in bursts, and the symptom is image artefacts, not a dropped call.
`net.core.rmem_max` is not namespaced, so Docker refuses to set it per container
— it has to be set on the host.

```bash
echo 'net.core.rmem_max=5000000' > /etc/sysctl.d/99-livekit.conf
sysctl -w net.core.rmem_max=5000000
```

### Firewalls

Open 443 TCP, 7881 TCP and the UDP range. If your provider has its own firewall
in front of the machine, it usually runs *before* anything you configure on the
host — open the ports in both places. When media falls back to TURN over TCP the
symptom is latency and stutter, not a failed connection, so check UDP before
investigating anything else.

### Creating rooms

There is no HTTP route that creates a room, so the command runs inside the
container:

```bash
docker exec -w /app <container> pnpm room:create
```

The working directory matters: the repository root is where `package.json` lives.
The image is Alpine, so the shell is `sh`, not `bash`.

`room:list`, `room:check`, `room:lock` and `room:close` work the same way.
