import { LiveApp } from "./LiveApp";
import { Notice } from "./scenes/Notice";
import { readRoomUrl } from "./api";
import { ui } from "./strings";

/** Three destinations, so no router. */
export function App() {
  const url = readRoomUrl();

  if (url.kind === "root") {
    return <Notice heading={ui.landing.heading} body={ui.landing.body} />;
  }

  if (url.kind === "malformed") {
    return <Notice heading={ui.notice.brokenHeading} body={ui.notice.brokenBody} />;
  }

  return <LiveApp roomToken={url.token} />;
}
