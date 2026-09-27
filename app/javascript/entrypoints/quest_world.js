// /game/world?seed=N: zoomed-out map of a generated quest world, for tuning generation
import { renderWorldDebug } from "../quest/world/debug_view";

const root = document.getElementById("quest-world");
const seed = new URLSearchParams(location.search).get("seed");
if (root) renderWorldDebug(root, seed === null ? undefined : Number(seed));
