import covers from "virtual:bookguard-cover-manifest";

export function coverImage(cover: string, sizes: string) {
  const variants = covers[cover];
  if (variants?.length) {
    const largest = variants[variants.length - 1];
    return { src: largest.url, srcSet: variants.map(image => `${image.url} ${image.width}w`).join(", "), sizes };
  }
  // Uploaded/custom URLs keep their original source. Only the known provider
  // supports these size variants; never invent URLs for an arbitrary image.
  if (/^https:\/\/covers\.openlibrary\.org\/b\/.+-L\.jpg$/.test(cover)) {
    return { src: cover, srcSet: `${cover.replace(/-L\.jpg$/, "-M.jpg")} 180w, ${cover} 500w`, sizes };
  }
  return { src: cover };
}
