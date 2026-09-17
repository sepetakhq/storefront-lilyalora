import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

// The hero reads the brand from config and the section list from the home
// query. Both are mocked so the composition can be asserted directly, which is
// the whole point: how many pictures a shop uploaded is what decides it, and
// that is not something a rendered provider makes easy to vary.
const config = { brand: {} };
vi.mock('@sepetakhq/storefront-kit/config/ConfigProvider', () => ({
  useConfig: () => config,
}));

const home = { data: { sections: [] }, isPending: false, isError: false };
vi.mock('@sepetakhq/storefront-kit/hooks/queries', () => ({
  useHome: () => home,
}));

const HomeRoute = (await import('./HomeRoute.jsx')).default;

const HERO = { title: 'Mekar dalam', em: 'Bersinar', sub: 'Kecantikan sejati.', cta: 'Belanja' };

function img(alt) {
  return { url: `https://cdn.test/${alt}.jpg`, srcset: '', alt };
}

function setup({ brand = {}, hero = HERO } = {}) {
  config.brand = { heroImages: [], heroStats: [], ...brand };
  home.data = { sections: [{ id: 'h', type: 'hero', hero }] };
  return render(
    <MemoryRouter>
      <HomeRoute />
    </MemoryRouter>,
  );
}

describe('Hero', () => {
  // The layout was drawn around two pictures, and a shop that uploaded one got
  // it with a piece missing: a photo capped at 58% of its column to leave room
  // for a card that was never there.
  it('gives a single picture the whole column, with its echo and wash', () => {
    const { container } = setup({ brand: { heroImages: [img('satu')] } });

    const photo = screen.getByAltText('satu');
    expect(container.querySelectorAll('img').length).toBe(1);
    // 420, not the pair's 300: the picture is no longer leaving room for a
    // second one. jsdom reprints the value, so the cap is what is asserted.
    expect(photo.closest('div').style.width).toContain('420px');
    expect(screen.getByTestId('hero-echo')).toBeTruthy();
    expect(screen.getByTestId('hero-halo')).toBeTruthy();
  });

  // Shops on the old layout keep it. The echo belongs to the solo arch only --
  // the pair already overlaps, and a third outline behind it is clutter.
  it('keeps the overlapping pair for two pictures', () => {
    const { container } = setup({ brand: { heroImages: [img('satu'), img('dua')] } });

    expect(container.querySelectorAll('img').length).toBe(2);
    expect(screen.getByAltText('satu')).toBeTruthy();
    expect(screen.getByAltText('dua')).toBeTruthy();
    expect(screen.queryByTestId('hero-echo')).toBeNull();
  });

  // The field accepts any number of uploads and always has. Two is what the
  // page shows; the backoffice hint now says so rather than leaving a merchant
  // to wonder where the other three went.
  it('shows the first two and no more', () => {
    const { container } = setup({
      brand: { heroImages: [img('satu'), img('dua'), img('tiga')] },
    });

    expect(container.querySelectorAll('img').length).toBe(2);
    expect(screen.queryByAltText('tiga')).toBeNull();
  });

  // An empty image column used to render the wash and nothing else, which read
  // as a stray pink cloud beside the headline.
  it('renders no image column at all without a picture', () => {
    const { container } = setup({ brand: { heroImages: [] } });

    expect(container.querySelectorAll('img').length).toBe(0);
    expect(screen.queryByTestId('hero-echo')).toBeNull();
    expect(screen.queryByTestId('hero-halo')).toBeNull();
    expect(screen.getByRole('heading', { name: /Mekar dalam/ })).toBeTruthy();
  });

  it('renders every stat it is given', () => {
    setup({
      brand: {
        heroImages: [img('satu')],
        heroStats: [
          { value: '100%', label: 'Voal premium' },
          { value: '1–2 hari', label: 'Diproses' },
        ],
      },
    });

    expect(screen.getByText('Voal premium')).toBeTruthy();
    expect(screen.getByText('Diproses')).toBeTruthy();
  });

  // Stats go empty on their own: ConfigProvider withholds any label naming a
  // free-shipping threshold when the offer is off. The row cannot be left
  // rendering its own top margin, and the columns cannot stay centred around a
  // text block that is now much shorter than the photo.
  it('drops the stat row and top-aligns the columns when there are no stats', () => {
    const { container } = setup({ brand: { heroImages: [img('satu')], heroStats: [] } });

    expect(screen.queryByTestId('hero-stats')).toBeNull();
    expect(container.querySelector('section').style.alignItems).toBe('flex-start');
  });

  it('centres the columns when the stats are there', () => {
    const { container } = setup({
      brand: { heroImages: [img('satu')], heroStats: [{ value: '100%', label: 'Voal' }] },
    });

    expect(container.querySelector('section').style.alignItems).toBe('center');
  });

  // The API requires a title and nothing else, so the accent line is optional.
  // Rendered unconditionally it left a line break under the headline and an
  // empty line of 64px type below it.
  it('renders no accent line when the shop left it empty', () => {
    const { container } = setup({
      brand: { heroImages: [img('satu')] },
      hero: { ...HERO, em: '  ' },
    });

    expect(container.querySelector('h1 em')).toBeNull();
    expect(container.querySelector('h1 br')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Mekar dalam' })).toBeTruthy();
  });

  it('renders the accent line when there is one', () => {
    const { container } = setup({ brand: { heroImages: [img('satu')] } });

    expect(container.querySelector('h1 em').textContent).toBe('Bersinar');
  });

  // Sections are dropped server-side when they resolve to nothing, and the
  // page has to read correctly with any subset.
  it('renders nothing for a hero section with no payload', () => {
    const { container } = setup({ brand: { heroImages: [img('satu')] }, hero: null });

    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.querySelector('h1')).toBeNull();
  });
});
