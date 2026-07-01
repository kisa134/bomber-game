/** Screen-reader announcements via persistent aria-live regions (Master spec §8). */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  if (typeof document === "undefined") return;
  const region = document.getElementById(`aria-live-${priority}`);
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}
