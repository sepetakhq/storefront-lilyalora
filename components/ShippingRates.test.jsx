import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Testing Library only registers its own cleanup when vitest runs with
// globals, which this project does not.
afterEach(cleanup);

// The rate list itself needs a QueryClient and a live endpoint; the failure
// panel needs neither, and the failure panel is what has been getting this
// wrong. Imported through the module under test so the export stays honest.
const { RateProblem } = await import('./ShippingRates.jsx');

import { ApiError } from '../api/client.js';

describe('RateProblem', () => {
  // The regression this file exists for.
  //
  // isNetwork is a getter returning a boolean, and the panel called it as
  // error?.isNetwork?.(). Optional call only short-circuits on null and
  // undefined, so on a real network failure this evaluated true?.() and threw
  // a TypeError while rendering -- the one screen whose job is to explain a
  // failure crashed exactly when a failure happened.
  it('renders a network failure instead of throwing', () => {
    const err = new ApiError(0, 'network', 'Koneksi bermasalah.');
    expect(err.isNetwork).toBe(true);

    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Ongkir belum bisa dihitung sekarang.')).toBeTruthy();
  });

  it('offers a retry for a provider outage', () => {
    const err = new ApiError(503, 'rates_unavailable', 'Ongkir belum bisa dihitung sekarang.');
    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Hitung ulang')).toBeTruthy();
  });

  // A destination nobody serves cannot be fixed by waiting, so the panel has
  // to send the buyer back to the picker rather than offer a retry.
  it('sends the buyer back to the picker when no courier serves the place', () => {
    const err = new ApiError(409, 'no_routes', 'Belum ada kurir yang melayani tujuan ini.');
    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Ganti tujuan')).toBeTruthy();
  });

  it('names the merchant when the product data is incomplete', () => {
    const err = new ApiError(409, 'shipping_unavailable', 'Ongkir belum bisa dihitung.');
    render(<RateProblem error={err} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Ongkir untuk produk ini belum bisa dihitung.')).toBeTruthy();
  });

  it('treats an empty courier list as retryable', () => {
    // options.length === 0 renders this panel with error=null.
    render(<RateProblem error={null} onRetry={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Hitung ulang')).toBeTruthy();
  });
});
