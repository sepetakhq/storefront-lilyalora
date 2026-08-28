// localStorage is the one input we cannot validate at the source: it survives
// deploys, it can be edited by hand, and it throws outright in some private
// modes. Every read here is total — a corrupt value yields the fallback and
// clears itself rather than crashing the app on boot.

const LEGACY_PREFIX = 'la2_';

export function readJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    try {
      store.removeItem(key);
    } catch {
      /* nothing more we can do */
    }
    return fallback;
  }
}

export function writeJson(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, or storage disabled. The caller decides whether that is
    // fatal; for the track token it very nearly is, which is why it is written
    // first and its failure is surfaced.
    return false;
  }
}

export function removeKey(store, key) {
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

let purgedLegacy = false;

/** True when this visit cleared a prototype-era cart. */
export function didPurgeLegacy() {
  return purgedLegacy;
}

/**
 * Clears every key from the prototype's localStorage era.
 *
 * Those values describe a catalogue that no longer exists: products keyed
 * `p1`..`p8`, locally invented order numbers, client-computed prices. None of
 * it can be mapped onto server data, and guessing a mapping risks ordering the
 * wrong scarf.
 *
 * Whether a cart was among them is remembered, so the cart screen can explain
 * itself once instead of silently appearing empty.
 */
export function purgeLegacyKeys() {
  let found = false;
  let doomedIncludedCart = false;
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_PREFIX)) {
        doomed.push(key);
        if (key === 'la2_cart') doomedIncludedCart = true;
      }
    }
    for (const key of doomed) {
      localStorage.removeItem(key);
      found = true;
    }
  } catch {
    /* storage unavailable — nothing to purge */
  }
  // A cart is the only legacy key a buyer would notice going missing.
  purgedLegacy = found && doomedIncludedCart;
  return found;
}
