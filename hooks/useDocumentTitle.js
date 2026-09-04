import { useEffect } from 'react';

/**
 * Keeps the tab title in step with client-side navigation.
 *
 * The server writes the title the document arrives with, and every other head
 * tag besides (backend/internal/seo). This exists for the one thing it cannot
 * do: an SPA route change never re-fetches the document, so the tab and the
 * history entry would otherwise keep the title of whichever page was loaded
 * first.
 *
 * Two rules, both easy to get wrong:
 *
 *  - An empty title writes nothing. The server already put the correct one
 *    there, so overwriting it with a placeholder while a query is pending makes
 *    the tab flash from right to wrong and back.
 *  - It never restores the previous title on unmount. Every route sets one, and
 *    a restore on the way out races the next route's set.
 *
 * Idempotent by construction, which matters because main.jsx mounts under
 * StrictMode and effects run twice in development. That safety depends on this
 * only ever assigning document.title -- appending a <meta> element here would
 * append it twice, and would not help a single crawler anyway.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title || title === document.title) return;
    document.title = title;
  }, [title]);
}
