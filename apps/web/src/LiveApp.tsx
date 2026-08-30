import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import type { SessionState } from "@drive-in/shared";
import { JoinRoom } from "./scenes/JoinRoom";
import { ParkingLot } from "./scenes/ParkingLot";
import { OnAir } from "./scenes/OnAir";
import { DjLeaveButton, DjPanel } from "./scenes/DjBooth";
import { Toast } from "./components/Toast";
import { FullscreenView } from "./scenes/FullscreenView";
import { Notice } from "./scenes/Notice";
import { useRoom } from "./hooks/useRoom";
import { useLiveKit } from "./hooks/useLiveKit";
import { useFullscreen } from "./hooks/useFullscreen";
import { formatStats, useScreenStats } from "./hooks/useScreenStats";
import { VolumeProvider } from "./hooks/useVolumes";
import { useArrivalSounds } from "./hooks/useArrivalSounds";
import { playMicOff, playMicOn } from "./sounds";
import { ui } from "./strings";

const LATENCY_MS = 5000;

export function LiveApp({ roomToken }: { roomToken: string }) {
  const room = useRoom(roomToken);
  // Stopping from the browser's own button has to give the stage back.
  const live = useLiveKit(room.me?.livekitUrl ?? null, room.me?.livekitToken ?? null, () =>
    void room.releaseStage(),
  );
  const { enter: enterFullscreen, exit: exitFullscreen } = useFullscreen();
  const [fullscreen, setFullscreen] = useState(false);
  /*
    DJ mode music volume. It lives here rather than inside the player, because
    what moves it is the volume control — the same place as the film and the
    voices.
  */
  const [musicVolume, setMusicVolume] = useState(70);
  /** Scene transition bookkeeping: which was the last one, and whether to animate. */
  const previousScene = useRef<string | null>(null);
  const animate = useRef(false);
  // The same numbers as the film scene, for the fullscreen badge.
  const stats = useScreenStats(live.screen ?? null);

  const state = room.state;
  const stage = state?.stage;
  const myId = room.me?.userId;

  useArrivalSounds(state?.participants, myId);

  // Everyone measures their own trip to the SFU and tells the server, which spreads it.
  const { readLatency } = live;
  const { reportLatency } = room;
  useEffect(() => {
    if (!live.connected) return;
    const tick = () => void readLatency().then((ms) => ms !== null && reportLatency(ms));
    tick();
    const id = setInterval(tick, LATENCY_MS);
    return () => clearInterval(id);
  }, [live.connected, readLatency, reportLatency]);
  const iAmOnStage = stage?.status === "occupied" && stage.userId === myId;

  // The api knows the names, LiveKit knows the voices: they meet on userId.
  const withSpeaking: SessionState | null = useMemo(() => {
    if (!state) return null;
    return {
      ...state,
      participants: state.participants.map((p) => ({
        ...p,
        speaking: live.speaking.has(p.userId),
      })),
    };
  }, [state, live.speaking]);

  /*
    Every scene comes in through the same shell. The key is its name: on a change
    of screen, React remounts the content and the entrance animation runs.

    The first one does not animate. Reloading the page mounts everything from
    scratch, and with no previous screen there is no transition — only a gratuitous
    effect on every F5. "opening" and "joining" do not count as a previous screen
    either: they are states you pass through, and arriving in the room should not
    look like a change.
  */
  const scene = (name: string, content: ReactNode) => {
    const transient = name === "opening" || name === "joining";
    if (!transient && previousScene.current !== name) {
      animate.current = previousScene.current !== null;
      previousScene.current = name;
    }
    return (
      <div key={name} className={`relative h-full${!transient && animate.current ? " scene-enter" : ""}`}>
        <Toast message={room.stageError ?? room.djError} />
        {content}
      </div>
    );
  };

  if (room.phase.name === "loading")
    return scene("opening", <Notice heading={ui.notice.loading} />);

  if (room.phase.name === "error") {
    // An old link is the common case: it deserves an explanation, not a raw error.
    return scene(
      "failure",
      room.phase.gone ? (
        <Notice heading={ui.notice.goneHeading} body={ui.notice.goneBody} />
      ) : (
        <Notice heading={ui.notice.failHeading} body={room.phase.message} />
      ),
    );
  }

  if (room.phase.name === "join") {
    return scene(
      "entry",
      <JoinRoom
        locked={room.phase.summary.locked}
        full={room.phase.summary.full}
        takenPaints={room.phase.summary.takenPaints}
        onJoin={room.join}
      />
    );
  }

  if (!withSpeaking || !room.me) return scene("joining", <Notice heading={ui.notice.joining} />);

  const toggleMic = () => {
    const me = withSpeaking.participants.find((p) => p.userId === myId);
    const next = !(me?.micEnabled ?? true);
    void live.setMic(next);
    room.setMicFlag(next);
    if (next) playMicOn();
    else playMicOff();
  };

  /** The server grants, then the browser asks. Cancel, and the stage goes back. */
  const takeAndShare = async () => {
    if (!(await room.takeStage())) return;
    if (!(await live.startScreenShare())) await room.releaseStage();
  };

  const releaseAndStop = async () => {
    await live.stopScreenShare();
    await room.releaseStage();
  };

  const goFullscreen = () => {
    void enterFullscreen();
    setFullscreen(true);
  };
  const leaveFullscreen = () => {
    void exitFullscreen();
    setFullscreen(false);
  };

  const volumeApi = {
    volumes: live.volumes,
    musicVolume,
    setMusicVolume,
    musicOn: withSpeaking.dj.active,
    setMovieVolume: live.setMovieVolume,
    setVoiceVolume: live.setVoiceVolume,
    others: withSpeaking.participants.filter((p) => p.userId !== myId),
  };

  if (fullscreen && live.screen) {
    return scene(
      "fullscreen",
      <VolumeProvider value={volumeApi}>
      <FullscreenView
        state={withSpeaking}
        currentUserId={room.me.userId}
        track={live.screen}
        localPreview={live.screenIsLocal}
        onToggleMic={toggleMic}
        onExit={leaveFullscreen}
        specs={formatStats(stats)}
        />
      </VolumeProvider>,
    );
  }

  if (live.screen) {
    return scene(
      "noAr",
      <VolumeProvider value={volumeApi}>
      <OnAir
        state={withSpeaking}
        currentUserId={room.me.userId}
        track={live.screen}
        localPreview={live.screenIsLocal}
        onReleaseStage={() => void releaseAndStop()}
        onToggleMic={toggleMic}
        onToggleFullscreen={goFullscreen}
        onLeave={room.leave}
        />
      </VolumeProvider>,
    );
  }

  /*
    DJ mode comes before the parking lot and after the big screen: the two modes
    are exclusive, and taking the screen already turns the DJ off server-side.
  */
  /*
    One key for both: DJ mode is the same scene with the framing closed in. With
    different keys React remounted everything on the change and the scene fell
    back to its default height before measuring itself — that was the jump on the
    way in and out.
  */
  return scene(
    "room",
    <VolumeProvider value={volumeApi}>
    <ParkingLot
      state={withSpeaking}
      onPickFeature={room.pickFeature}
      currentUserId={room.me.userId}
      onTakeStage={() => void takeAndShare()}
      onEnterDj={room.dj.enter}
      /*
        DJ mode is the same scene with the camera closed in on the dashboard and
        its content swapped. One screen only: the car is still there, it is the
        big screen that leaves the frame.
      */
      zoom={withSpeaking.dj.active}
      dashContent={
        withSpeaking.dj.active ? (
          <DjPanel
            state={withSpeaking}
            currentUserId={room.me.userId}
            onAdd={room.dj.add}
            onRemove={room.dj.remove}
            onClear={room.dj.clear}
            onPlay={room.dj.play}
            onToggle={room.dj.toggle}
            onSkip={room.dj.skip}
            onEnded={room.dj.ended}
            volume={musicVolume}
          />
        ) : undefined
      }
      extraControl={
        withSpeaking.dj.active ? <DjLeaveButton onClick={room.dj.leave} /> : undefined
      }
      onToggleMic={toggleMic}
      onToggleFullscreen={goFullscreen}
      onLeave={room.leave}
      busyLabel={
        stage?.status === "occupied" && !iAmOnStage ? ui.onAir.badge(stage.displayName) : undefined
      }
      />
    </VolumeProvider>,
  );
}
