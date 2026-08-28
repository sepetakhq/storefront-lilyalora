import { useState } from 'react';

/**
 * The one image component. Replaces every CSS `background-image` in the
 * storefront, because a background cannot carry `srcset` at all — which is why
 * the API's WebP variants were dead weight and buyers downloaded 1.9 MB
 * originals for a 260px card.
 *
 * Layout space is reserved by the wrapper's aspect-ratio, taken from the call
 * site rather than the payload. That is what prevents layout shift: the API
 * reports intrinsic dimensions of the *original* and reports 0 when it does
 * not know them, so neither is a safe basis for reserving space.
 *
 * @param {string} src        full URL, or "" for "no image" (a documented value)
 * @param {string} [srcSet]   ready-to-use "url 400w, url 800w" string, or ""
 * @param {string} ratio      CSS aspect-ratio for this usage, e.g. "4/5"
 * @param {string} [sizes]    required for srcSet to pick sensibly
 */
export function Img({
  src,
  srcSet,
  sizes,
  alt = '',
  ratio = '4/5',
  radius = 0,
  width,
  height,
  priority = false,
  className,
  style,
  onError,
}) {
  const [failed, setFailed] = useState(false);
  const missing = !src || failed;

  const frame = {
    position: 'relative',
    aspectRatio: ratio,
    borderRadius: radius || undefined,
    overflow: 'hidden',
    // Stands in for the image while it loads and after a failure, so a slow
    // or missing photo reads as part of the design rather than a hole.
    background: 'linear-gradient(135deg, #FBF3E4 0%, #FDF0F4 100%)',
    ...style,
  };

  if (missing) {
    return <div className={className} style={frame} role="img" aria-label={alt} />;
  }

  return (
    <div className={className} style={frame}>
      <img
        src={src}
        // Never emit srcSet="" — an empty candidate list is not the same as
        // no candidate list, and browsers disagree about what it means.
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        // The intrinsic size helps the preload scanner; the ratio wrapper has
        // already handled layout, so 0 simply means "omit".
        width={width || undefined}
        height={height || undefined}
        loading={priority ? 'eager' : 'lazy'}
        // Lowercase: React 18 passes unknown camelCase props through as-is and
        // warns. React 19 renames this to fetchPriority.
        fetchpriority={priority ? 'high' : undefined}
        decoding="async"
        // A 200 with a valid content-type is not a guarantee the bytes decode:
        // a truncated upload arrives as image/jpeg and only fails here. Callers
        // that can drop the image entirely (a gallery) are told about it.
        onError={() => {
          setFailed(true);
          onError?.();
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

/** `sizes` per usage site, kept together so they stay consistent. */
export const SIZES = {
  card: '(max-width: 560px) 50vw, (max-width: 900px) 33vw, 280px',
  productMain: '(max-width: 900px) 100vw, 520px',
  thumb: '74px',
  cartLine: '72px',
  summaryLine: '44px',
  categoryTile: '(max-width: 900px) 50vw, 420px',
  hero: '(max-width: 900px) 100vw, 560px',
};
