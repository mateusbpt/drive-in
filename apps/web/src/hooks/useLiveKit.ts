import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioPresets,
  LocalVideoTrack,
  RemoteAudioTrack,
  type RemoteTrack,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

/**
 * Voice. The filters stay on because almost everybody is on speakers, and
 * without echo cancellation the room turns into feedback.
 */
const MIC_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

const MIC_PUBLISH = {
  /**
   * `dtx` stops transmitting during silence to save bandwidth, and that is what
   * eats the start of words — speech resumes before the codec does. In a room of
   * six, the saving does not pay for the clipping.
   */
  dtx: false,
  /** Redundancy: one lost packet stops turning into a hole in the sentence. */
  red: true,
  audioPreset: AudioPresets.music,
} as const;

/** Separate tracks: a loud soundtrack should not force voices down with it. */
export type Volumes = {
  movie: number;
  voices: Record<string, number>;
};

export type ScreenTrack = RemoteVideoTrack | LocalVideoTrack;

type State = {
  screen: ScreenTrack | null;
  screenIsLocal: boolean;
  speaking: Set<string>;
  connected: boolean;
  sharing: boolean;
};

/**
 * Uses `livekit-client` directly rather than the ready-made components: the
 * interface is our own and what we need from here is small.
 */
export function useLiveKit(
  livekitUrl: string | null,
  token: string | null,
  onShareEnded?: () => void,
) {
  const roomRef = useRef<Room | null>(null);
  const endedRef = useRef(onShareEnded);
  endedRef.current = onShareEnded;

  const [state, setState] = useState<State>({
    screen: null,
    screenIsLocal: false,
    speaking: new Set(),
    connected: false,
    sharing: false,
  });

  const [volumes, setVolumes] = useState<Volumes>({ movie: 1, voices: {} });
  // A separate ref: the volume has to apply to tracks that arrive later.
  const volumesRef = useRef(volumes);

  const applyVolumes = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        if (!(pub.track instanceof RemoteAudioTrack)) continue;
        const isMovie = pub.source === Track.Source.ScreenShareAudio;
        pub.track.setVolume(
          isMovie ? volumesRef.current.movie : (volumesRef.current.voices[p.identity] ?? 1),
        );
      }
    }
  }, []);

  const setMovieVolume = useCallback(
    (value: number) => {
      volumesRef.current = { ...volumesRef.current, movie: value };
      setVolumes(volumesRef.current);
      applyVolumes();
    },
    [applyVolumes],
  );

  /** One friend with a blown-out microphone should not turn the room down. */
  const setVoiceVolume = useCallback(
    (userId: string, value: number) => {
      volumesRef.current = {
        ...volumesRef.current,
        voices: { ...volumesRef.current.voices, [userId]: value },
      };
      setVolumes(volumesRef.current);
      applyVolumes();
    },
    [applyVolumes],
  );

  useEffect(() => {
    if (!livekitUrl || !token) return;

    const room = new Room({ adaptiveStream: false, dynacast: false });
    roomRef.current = room;

    /**
     * Audio needs an element in the document to play — video has its own in the
     * scene, sound has nowhere to live. Without this the whole room is silent,
     * and nothing in the console says why.
     */
    const onSubscribed = (track: RemoteTrack) => {
      if (track instanceof RemoteAudioTrack) {
        const el = track.attach();
        el.style.display = "none";
        document.body.appendChild(el);
      }
      refreshScreen();
      // A new track arrives at the default volume; realign it with the chosen one.
      applyVolumes();
    };

    const onUnsubscribed = (track: RemoteTrack) => {
      if (track instanceof RemoteAudioTrack) {
        for (const el of track.detach()) el.remove();
      }
      refreshScreen();
    };

    const refreshScreen = () => {
      // Your own track does not come back from the SFU: with no local preview,
      // whoever is broadcasting sees a dark screen and thinks it broke.
      const mine = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (mine instanceof LocalVideoTrack) {
        setState((s) => ({ ...s, screen: mine, screenIsLocal: true }));
        return;
      }

      let found: RemoteVideoTrack | null = null;
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.videoTrackPublications.values()) {
          // `isSubscribed` matters: the publication outlives the track by an
          // instant, and without the check the scene holds a dead track — which
          // is exactly the black screen the viewers were getting.
          if (
            pub.isSubscribed &&
            pub.track instanceof RemoteVideoTrack &&
            pub.source === Track.Source.ScreenShare
          ) {
            found = pub.track;
          }
        }
      }
      setState((s) => ({ ...s, screen: found, screenIsLocal: false }));
    };

    // We only need identity, which the base type already has: avoids the cast.
    const onSpeakers = (speakers: { identity: string }[]) => {
      setState((s) => ({ ...s, speaking: new Set(speakers.map((p) => p.identity)) }));
    };

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.TrackUnpublished, refreshScreen)
      .on(RoomEvent.TrackMuted, refreshScreen)
      .on(RoomEvent.ParticipantDisconnected, refreshScreen)
      .on(RoomEvent.ActiveSpeakersChanged, onSpeakers)
      .on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) refreshScreen();
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        // The browser's own stop button does not go through our interface.
        // Without this, the stage stays stuck for the whole room.
        if (pub.source === Track.Source.ScreenShare) {
          setState((s) => ({ ...s, sharing: false, screen: null, screenIsLocal: false }));
          endedRef.current?.();
        }
      })
      .on(RoomEvent.Disconnected, () => setState((s) => ({ ...s, connected: false })));

    void room
      .connect(livekitUrl, token)
      .then(() => {
        setState((s) => ({ ...s, connected: true }));
        refreshScreen();
        // The browser may block autoplay; entering the room is a user gesture,
        // so this normally releases it.
        void room.startAudio().catch(() => undefined);
        // A denied permission is not a connection failure; lumping the two
        // together sends you hunting for a network problem that is not there.
        return room.localParticipant
          .setMicrophoneEnabled(true, MIC_CAPTURE, MIC_PUBLISH)
          .catch((err: Error) => {
            console.warn("[livekit] microphone did not open:", err.message);
          });
      })
      .catch((err: Error) => console.error("[livekit] connection failed:", err.message));

    return () => {
      roomRef.current = null;
      void room.disconnect();
    };
  }, [livekitUrl, token, applyVolumes]);

  /**
   * Round trip to the SFU. We read the raw report instead of using
   * `getSenderStats()`: for audio the SDK looks for `roundTripTime` on
   * `outbound-rtp`, and by spec that field lives on `remote-inbound-rtp` — so
   * the value always came back undefined.
   *
   * The candidate pair is the second source, and the better one: it is the
   * transport's own time, which exists even with the microphone muted.
   */
  const readLatency = useCallback(async (): Promise<number | null> => {
    const sender = roomRef.current?.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    )?.track?.sender;
    const report = await sender?.getStats().catch(() => null);
    if (!report) return null;

    let fromTransport: number | null = null;
    let fromRemote: number | null = null;
    report.forEach((stat) => {
      if (stat.type === "candidate-pair" && stat.state === "succeeded") {
        const rtt = (stat as { currentRoundTripTime?: number }).currentRoundTripTime;
        if (typeof rtt === "number") fromTransport = rtt;
      }
      if (stat.type === "remote-inbound-rtp") {
        const rtt = (stat as { roundTripTime?: number }).roundTripTime;
        if (typeof rtt === "number") fromRemote = rtt;
      }
    });

    const seconds = fromTransport ?? fromRemote;
    return seconds === null ? null : Math.round(seconds * 1000);
  }, []);

  const setMic = useCallback(async (enabled: boolean) => {
    // The same options as the first publish: without this, unmuting brings
    // `dtx` back and speech starts clipping again.
    await roomRef.current?.localParticipant.setMicrophoneEnabled(
      enabled,
      MIC_CAPTURE,
      MIC_PUBLISH,
    );
  }, []);

  /** Only works after the grant: without permission the SFU refuses the track. */
  const startScreenShare = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room) return false;
    try {
      await room.localParticipant.setScreenShareEnabled(
        true,
        {
          // Movie audio raw: voice filters destroy a soundtrack.
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          resolution: { width: 1920, height: 1080, frameRate: 30 },
          contentHint: "motion",
        },
        {
          videoEncoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
          // No lower layer: a bad connection freezes instead of blurring.
          simulcast: false,
          degradationPreference: "maintain-resolution",
        },
      );
      setState((s) => ({ ...s, sharing: true }));
      return true;
    } catch (err) {
      // Cancelling the picker lands here, and is not an error.
      console.warn("[livekit] share did not start:", (err as Error).message);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    await roomRef.current?.localParticipant.setScreenShareEnabled(false);
    setState((s) => ({ ...s, sharing: false }));
  }, []);

  return {
    ...state,
    volumes,
    setMovieVolume,
    setVoiceVolume,
    setMic,
    readLatency,
    startScreenShare,
    stopScreenShare,
  };
}
