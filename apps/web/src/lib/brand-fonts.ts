// The stylesheet itself can arrive early with media=print. Activate its font
// downloads once the first priority covers have loaded, so they share less
// bandwidth with visible content on a slow connection.
export function scheduleBrandFonts(): () => void {
  const link = document.getElementById("bookguard-fonts") as HTMLLinkElement | null;
  if (!link || link.media === "all") return () => {};
  const pending = new Set([...document.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]')].filter(image => !image.complete));
  let timer: number | undefined;
  function cleanup() {
    if (timer !== undefined) window.clearTimeout(timer);
    for (const image of pending) { image.removeEventListener("load", ready); image.removeEventListener("error", ready); }
    pending.clear();
  }
  function enable() { cleanup(); link!.media = "all"; }
  function ready(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    image.removeEventListener("load", ready); image.removeEventListener("error", ready);
    pending.delete(image);
    if (!pending.size) enable();
  }
  if (!pending.size) enable();
  else {
    for (const image of pending) { image.addEventListener("load", ready); image.addEventListener("error", ready); }
    timer = window.setTimeout(enable, 4000);
  }
  return cleanup;
}
