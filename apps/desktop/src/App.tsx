import { getCurrentWindow } from "@tauri-apps/api/window";
import OrbWindow from "./windows/OrbWindow";
import DesktopWindow from "./windows/DesktopWindow";

const label = getCurrentWindow().label;

export default function App() {
  return label === "orb" ? <OrbWindow /> : <DesktopWindow />;
}
