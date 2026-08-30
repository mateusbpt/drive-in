import { createContext, useContext, type ReactNode } from "react";
import type { Participant } from "@drive-in/shared";
import type { Volumes } from "./useLiveKit";

type VolumeApi = {
  volumes: Volumes;
  setMovieVolume: (value: number) => void;
  setVoiceVolume: (userId: string, value: number) => void;
  others: Participant[];
  /*
    DJ mode music volume, 0 to 100. It sits here with the others because anyone
    turning the sound down wants one place for all of them — the volume control.
  */
  musicVolume: number;
  setMusicVolume: (value: number) => void;
  /** There is only something to adjust while DJ mode is on. */
  musicOn: boolean;
};

const VolumeContext = createContext<VolumeApi | null>(null);

/** Only the popover needs this; threading it through every scene was noise. */
export function VolumeProvider({ value, children }: { value: VolumeApi; children: ReactNode }) {
  return <VolumeContext.Provider value={value}>{children}</VolumeContext.Provider>;
}

export function useVolumes(): VolumeApi {
  const api = useContext(VolumeContext);
  if (!api) throw new Error("useVolumes used outside VolumeProvider");
  return api;
}
