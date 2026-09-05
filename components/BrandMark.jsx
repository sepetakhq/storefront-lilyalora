import { useState } from 'react';

import { useConfig } from '../config/ConfigProvider.jsx';

/**
 * The shop's name at the top of the page: its uploaded logo, or its wordmark.
 *
 * Deliberately not `ui/Img.jsx`. That component reserves a fixed aspect ratio,
 * clips to it and paints a gradient while it loads — everything a photograph
 * wants and a logo does not. A logo whose ratio nobody knows would be cropped
 * by it, and the gradient would show through a transparent PNG.
 *
 * The height is fixed and the width is left to the image, because a wordmark
 * logo and a square monogram both arrive here and only one dimension can be
 * shared. Fixing the width instead would squash one of the two.
 *
 * On a failed load it falls back to the wordmark rather than leaving a hole.
 * That is not defensive decoration: the media pipeline never retries an asset
 * it once refused, so a logo that failed to encode stays broken until the
 * merchant re-uploads, and a shop's own header is the worst place to find out.
 *
 * @param {number} height   rendered height in px; width follows the image
 * @param {number} maxWidth cap, so an extremely wide logo cannot push the nav
 * @param {object} wordmark colours for the fallback: {primary, accent, size}
 */
export function BrandMark({ height, maxWidth, wordmark }) {
  const { brand } = useConfig();
  const [failed, setFailed] = useState(false);

  const logo = brand.logoImage;
  const name = [brand.wordmark_primary, brand.wordmark_accent].filter(Boolean).join(' ');

  if (logo?.url && !failed) {
    return (
      <img
        src={logo.url}
        srcSet={logo.srcset || undefined}
        // The logo is at most maxWidth wide at 1x, and the browser should pick
        // a rendition for that box rather than for the viewport.
        sizes={logo.srcset ? `${maxWidth}px` : undefined}
        // Never empty: this image *is* the shop's name, so a reader who cannot
        // see it still needs to be told which shop they are on. The merchant's
        // own alt text wins when they wrote one.
        alt={logo.alt || name}
        height={height}
        onError={() => setFailed(true)}
        style={{ height, width: 'auto', maxWidth, display: 'block', objectFit: 'contain' }}
      />
    );
  }

  return (
    <span
      style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontStyle: 'italic',
        fontWeight: 600,
        fontSize: wordmark.size,
        color: wordmark.primary,
      }}
    >
      {brand.wordmark_primary}{' '}
      <span style={{ color: wordmark.accent }}>{brand.wordmark_accent}</span>
    </span>
  );
}
