import urllib.request as u
o=u.urlopen("https://raw.githubusercontent.com/kisa134/bomber-game/906152b/apps/client/src/main.ts").read().decode()
o=o.replace('import { registerSW } from "virtual:pwa-register";','import { registerSW } from "virtual:pwa-register";\nimport { startCampaign, stopCampaign } from "./campaign/main.js";',1)
a='''// Game-mode picker: only Ranked Arena exists today — flash a "soon" note so
// the control isn't a dead button.
document.getElementById("hub-gamemode")?.addEventListener("click", () => {
  setMenuStatus("🌐 Ranked Arena — more modes coming soon");
  window.setTimeout(() => setMenuStatus(""), 2400);
});'''
b='''// Game-mode picker: dropdown with Arena, Sandbox, and World (Campaign) modes.
const gmDropdown = document.getElementById("gamemode-dropdown");
let currentMode = "arena";
document.getElementById("hub-gamemode")?.addEventListener("click", (e) => {
  e.stopPropagation();
  gmDropdown?.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!gmDropdown?.classList.contains("hidden") &&
      !(e.target as HTMLElement).closest("#hub-gamemode") &&
      !(e.target as HTMLElement).closest("#gamemode-dropdown")) {
    gmDropdown.classList.add("hidden");
  }
});
document.querySelectorAll(".gm-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.getAttribute("data-mode");
    if (!mode) return;
    currentMode = mode;
    gmDropdown?.classList.add("hidden");
    const gmLabel = document.getElementById("hub-gamemode-label");
    if (mode === "arena") {
      if (gmLabel) gmLabel.innerHTML = '🌐 Ranked Arena <span style="opacity:.6;margin-left:4px">▾</span>';
    } else if (mode === "sandbox") {
      if (gmLabel) gmLabel.innerHTML = '🧪 Sandbox <span style="opacity:.6;margin-left:4px">▾</span>';
      setMenuStatus("🧪 Sandbox — coming soon!");
      window.setTimeout(() => setMenuStatus(""), 2400);
    } else if (mode === "world") {
      if (gmLabel) gmLabel.innerHTML = '🌍 World <span style="opacity:.6;margin-left:4px">▾</span>';
      showScreen("campaign");
      const campaignEl = document.getElementById("campaign");
      if (campaignEl) { startCampaign(campaignEl, showScreen); }
    }
  });
});
// OLD:'''
o=o.replace(a,b,1)
c='''// PLAY ONLINE lands straight on the full-screen lobby browser.
document.getElementById("open-play")!.addEventListener("click", openLobby);'''
d='''// PLAY ONLINE: route based on selected game mode.
document.getElementById("open-play")!.addEventListener("click", () => {
  if (currentMode === "world") {
    showScreen("campaign");
    const campaignEl = document.getElementById("campaign");
    if (campaignEl) { startCampaign(campaignEl, showScreen); }
  } else if (currentMode === "sandbox") {
    setMenuStatus("🧪 Sandbox — coming soon!");
    window.setTimeout(() => setMenuStatus(""), 2400);
  } else { openLobby(); }
});'''
o=o.replace(c,d,1)
open('apps/client/src/main.ts','w').write(o)
print('ok',len(o))
