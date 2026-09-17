import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { Img, SIZES } from '../ui/Img.jsx';
import { CountdownCells } from '../ui/Countdown.jsx';
import { ErrorState, ProductGridSkeleton, Skeleton } from '../ui/states.jsx';
import { useHome } from '@sepetakhq/storefront-kit/hooks/queries';
import { qk } from '@sepetakhq/storefront-kit/api/queryKeys';
import { useConfig } from '@sepetakhq/storefront-kit/config/ConfigProvider';
import { fmt } from '@sepetakhq/storefront-kit/shared/format';

const wrap = { maxWidth: 1200, margin: '0 auto' };
const h2 = { fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 600, margin: 0 };
// Columns live in styles.css so the breakpoint can match the cards' `sizes`.

// The API sends a name; the palette stays here, where the rest of the design is.
const BANNER_BG = { pink: '#FDF0F4', butter: '#F5E6AE' };

export default function HomeRoute() {
  const { data, isPending, isError, error, refetch } = useHome();

  if (isPending) return <HomeSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Beranda gagal dimuat" />;

  const sections = data.sections ?? [];

  // Sections are dropped server-side when they resolve to nothing — a hidden
  // block, a campaign that ended, a grid whose products all sold out. The page
  // has to read correctly with any subset, including none.
  if (sections.length === 0) return <EmptyHome />;

  return (
    <main aria-label="Beranda" style={{ flex: 1 }}>
      {sections.map((sec, i) => (
        <Section key={sec.id} sec={sec} first={i === 0} />
      ))}
    </main>
  );
}

function Section({ sec, first }) {
  switch (sec.type) {
    case 'hero':
      return <Hero hero={sec.hero} />;
    case 'campaign':
      return <CampaignStrip campaign={sec.campaign} />;
    case 'cats':
      return <Categories cats={sec.cats} />;
    // A carousel carries its payload under `grid`: the server picks the field
    // by which props resolved, and both share one shape.
    case 'grid':
      return <Grid grid={sec.grid} priority={first} />;
    case 'carousel':
      return <Carousel grid={sec.grid} />;
    case 'banner':
      return <Banner banner={sec.banner} />;
    case 'story':
      return <Story story={sec.story} />;
    default:
      return null;
  }
}

// One shape, three weights: the photograph is an arch, a hairline echo of it
// sits down-right where the second picture used to, and the wash behind them is
// the same arch again. Given as a ratio rather than in pixels so the dome
// survives at 265px on a phone and at 420px on a desktop.
const ARCH = '50% 50% 24px 24px / 38% 38% 24px 24px';

function Hero({ hero }) {
  const { brand } = useConfig();
  const images = brand.heroImages ?? [];
  // A stat whose label names a discount the checkout would not give is dropped
  // in ConfigProvider, so an empty row is an ordinary state for a shop with
  // free shipping switched off -- not only for one that never filled it in.
  const stats = brand.heroStats ?? [];

  if (!hero) return null;

  return (
    <section
      style={{
        ...wrap,
        padding: '48px 20px 40px',
        display: 'flex',
        flexWrap: 'wrap',
        // Without the stats the text column is by far the shorter of the two,
        // and centring it leaves the headline floating halfway down the photo.
        alignItems: stats.length ? 'center' : 'flex-start',
        gap: 40,
      }}
    >
      <div style={{ flex: '1 1 380px', minWidth: 300 }}>
        {brand.hero_eyebrow ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#FDF6E3',
              border: '1px solid #F0E4CF',
              color: '#8A6D1F',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {brand.hero_eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontWeight: 600,
            fontSize: 'clamp(40px,6vw,64px)',
            lineHeight: 1.05,
            margin: '18px 0 14px',
          }}
        >
          {hero.title}
          {/* Only the title is required server-side. An accent line nobody
              wrote must not leave an empty line under the headline. */}
          {hero.em?.trim() ? (
            <>
              <br />
              <em style={{ color: '#D26E8E' }}>{hero.em}</em>
            </>
          ) : null}
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: '#8A7D70',
            maxWidth: '46ch',
            margin: '0 0 26px',
          }}
        >
          {hero.sub}
        </p>
        <Link
          className="hv-primary"
          to="/katalog"
          style={{
            display: 'inline-block',
            background: '#D26E8E',
            color: '#fff',
            borderRadius: 999,
            padding: '14px 30px',
            fontWeight: 700,
            fontSize: 15,
            boxShadow: '0 8px 20px rgba(210,110,142,0.3)',
          }}
        >
          {hero.cta}
        </Link>

        {stats.length ? (
          <div
            data-testid="hero-stats"
            style={{ display: 'flex', gap: 28, marginTop: 34, flexWrap: 'wrap' }}
          >
            {stats.map((stat) => (
              <div key={stat.label}>
                <div
                  style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700 }}
                >
                  {stat.value}
                </div>
                {/* Copy ships with a {free_shipping_min} placeholder, already
                    substituted — the API does not own Rupiah formatting. */}
                <div style={{ fontSize: 12.5, color: '#8A7D70' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* A shop with no hero picture gets no image column at all: an empty one
          rendered nothing but the wash, which reads as a stray pink cloud. */}
      {images.length >= 2 ? <HeroPair big={images[0]} small={images[1]} /> : null}
      {images.length === 1 ? <HeroSolo image={images[0]} /> : null}
    </section>
  );
}

const imageColumn = {
  flex: '1 1 380px',
  minWidth: 300,
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  padding: '20px 0',
};

/**
 * Two pictures, overlapping. Unchanged since it was the only hero there was:
 * the pair carries its own composition, so it keeps the blob it was drawn
 * around rather than borrowing the solo arches.
 */
function HeroPair({ big, small }) {
  return (
    <div style={imageColumn}>
      <div
        className="la-floaty"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '10% 6% 6% 10%',
          background: 'radial-gradient(circle at 30% 30%,#F5E6AE,#FADCE4 70%)',
          borderRadius: '48% 52% 55% 45% / 50% 46% 54% 50%',
        }}
      />
      <Img
        src={big.url}
        srcSet={big.srcset}
        alt={big.alt}
        ratio="4/5"
        sizes={SIZES.hero}
        priority
        style={{
          position: 'relative',
          width: 'min(58%,300px)',
          borderRadius: '160px 160px 22px 22px',
          border: '6px solid #FFFDF7',
          boxShadow: '0 20px 40px rgba(67,56,46,0.16)',
        }}
      />
      <Img
        src={small.url}
        srcSet={small.srcset}
        alt={small.alt}
        ratio="3/4"
        sizes={SIZES.hero}
        priority
        style={{
          position: 'relative',
          width: 'min(38%,200px)',
          borderRadius: 22,
          border: '6px solid #FFFDF7',
          boxShadow: '0 16px 34px rgba(67,56,46,0.18)',
          alignSelf: 'flex-end',
          marginLeft: -60,
          marginBottom: -8,
        }}
      />
    </div>
  );
}

/**
 * One picture, which is what most shops upload. It is sized to own the column
 * rather than to leave room for a second card, and the depth the missing card
 * used to give comes from an outline of the same arch offset behind it.
 */
function HeroSolo({ image }) {
  return (
    <div style={imageColumn}>
      {/* Two elements, because `floaty` animates `transform` and would
          otherwise overwrite the one placing this off-centre. The outer div
          places, the inner one drifts. */}
      <div
        aria-hidden="true"
        data-testid="hero-halo"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: 'min(92%,480px)',
          aspectRatio: '4/5',
          transform: 'translate(calc(-50% - 18px),-20px)',
          pointerEvents: 'none',
        }}
      >
        <div
          className="la-floaty"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: ARCH,
            background:
              'radial-gradient(120% 90% at 30% 20%,#F7E9BC,#FADCE4 62%,rgba(250,220,228,0) 100%)',
          }}
        />
      </div>
      <div
        aria-hidden="true"
        data-testid="hero-echo"
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          width: 'min(78%,420px)',
          aspectRatio: '4/5',
          transform: 'translate(calc(-50% + 22px),22px)',
          borderRadius: ARCH,
          border: '1px solid #E7D6AE',
          pointerEvents: 'none',
        }}
      />
      <Img
        src={image.url}
        srcSet={image.srcset}
        alt={image.alt}
        ratio="4/5"
        sizes={SIZES.heroSolo}
        priority
        style={{
          position: 'relative',
          width: 'min(78%,420px)',
          borderRadius: ARCH,
          border: '6px solid #FFFDF7',
          boxShadow: '0 20px 40px rgba(67,56,46,0.16)',
        }}
      />
    </div>
  );
}

const HOURS_72 = 72 * 60 * 60 * 1000;

function CampaignStrip({ campaign }) {
  const queryClient = useQueryClient();
  if (!campaign) return null;

  const endsAt = campaign.ends_at;
  // A countdown only earns its place when the deadline is close enough to
  // change a decision. Above three days it is noise.
  const showCountdown = endsAt && Date.parse(endsAt) - Date.now() < HOURS_72;

  return (
    <section
      style={{
        background: '#FDF0F4',
        borderTop: '1px solid #F7DCE5',
        borderBottom: '1px solid #F7DCE5',
      }}
    >
      <div style={{ ...wrap, padding: '40px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  background: '#D26E8E',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  borderRadius: 999,
                  padding: '5px 14px',
                }}
              >
                {campaign.badge}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#D26E8E',
                }}
              >
                {discountLabel(campaign)}
              </span>
            </div>
            <h2 style={{ ...h2, margin: '6px 0 0' }}>{campaign.title}</h2>
          </div>
          {showCountdown ? (
            <CountdownCells
              until={endsAt}
              // The section disappears server-side once the promotion stops
              // being live, so refetching is the whole correct response.
              onExpire={() => queryClient.invalidateQueries({ queryKey: qk.home })}
            />
          ) : null}
        </div>
        <div className="product-grid">
          {campaign.products.map((p) => (
            <ProductCard key={p.id} p={p} variant="campaign" />
          ))}
        </div>
      </div>
    </section>
  );
}

function discountLabel(c) {
  if (c.discount_type === 'percentage') return `Diskon ${c.discount_value}%`;
  return `Potongan ${fmt(c.discount_value)}`;
}

function Categories({ cats }) {
  const { brand } = useConfig();
  if (!cats?.length) return null;

  return (
    <section style={{ ...wrap, padding: '52px 20px 10px' }}>
      <h2 style={{ ...h2, margin: '0 0 20px' }}>{brand.sections.cats_heading}</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 18,
        }}
      >
        {cats.map((c) => (
          <Link
            key={c.key}
            to={`/katalog?cat=${encodeURIComponent(c.key)}`}
            style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', display: 'block' }}
          >
            {/* categoryDTO carries no intrinsic dimensions, so the ratio
                wrapper is what reserves the space. */}
            <Img
              src={c.image}
              srcSet={c.image_srcset}
              alt={c.label}
              ratio="7/8"
              sizes={SIZES.categoryTile}
              style={{ minHeight: 320 }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 'auto 0 0 0',
                background: 'linear-gradient(transparent,rgba(67,56,46,0.72))',
                padding: '70px 22px 20px',
                color: '#fff',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 30,
                  fontWeight: 600,
                }}
              >
                {c.label}
              </span>
              <span style={{ display: 'block', fontSize: 13.5, opacity: 0.9 }}>{c.subtitle}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Grid({ grid, priority }) {
  const { brand } = useConfig();
  if (!grid) return null;

  return (
    <section style={{ ...wrap, padding: '48px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <h2 style={h2}>{grid.title}</h2>
        <Link className="hv-pink" to="/katalog" style={{ fontWeight: 700, color: '#B4557A', fontSize: 14.5 }}>
          {brand.sections.grid_see_all}
        </Link>
      </div>
      <div className="product-grid">
        {grid.products.map((p, i) => (
          <ProductCard key={p.id} p={p} variant="grid" priority={priority && i < 4} />
        ))}
      </div>
    </section>
  );
}

function Carousel({ grid }) {
  if (!grid) return null;
  return (
    <section style={{ ...wrap, padding: '48px 20px' }}>
      <h2 style={{ ...h2, margin: '0 0 20px' }}>{grid.title}</h2>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12 }}>
        {grid.products.map((p) => (
          <ProductCard key={p.id} p={p} variant="carousel" />
        ))}
      </div>
    </section>
  );
}

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <section style={{ ...wrap, padding: '24px 20px' }}>
      <div
        style={{
          background: BANNER_BG[banner.bg] ?? BANNER_BG.butter,
          borderRadius: 22,
          padding: '28px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 'clamp(22px,3vw,30px)',
            fontWeight: 600,
            color: '#43382E',
          }}
        >
          {banner.text}
        </div>
        <Link
          className="hv-dark"
          to="/katalog"
          style={{
            background: '#43382E',
            color: '#FFFDF7',
            borderRadius: 999,
            padding: '13px 28px',
            fontWeight: 700,
            fontSize: 14.5,
            flexShrink: 0,
          }}
        >
          {banner.cta}
        </Link>
      </div>
    </section>
  );
}

function Story({ story }) {
  const { brand } = useConfig();
  if (!story) return null;

  return (
    <section style={{ background: '#FDF6E3', borderTop: '1px solid #F0E4CF' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 20px', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#B49E6A',
          }}
        >
          {brand.sections.story_eyebrow}
        </div>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 'clamp(28px,4vw,40px)',
            fontWeight: 600,
            margin: '12px auto 14px',
            maxWidth: '22ch',
          }}
        >
          {story.title}
        </h2>
        <p
          style={{
            color: '#8A7D70',
            fontSize: 16,
            lineHeight: 1.7,
            maxWidth: '60ch',
            margin: '0 auto 24px',
          }}
        >
          {story.text}
        </p>
        <Link
          className="hv-dark"
          to="/tentang"
          style={{
            display: 'inline-block',
            background: '#43382E',
            color: '#FFFDF7',
            borderRadius: 999,
            padding: '13px 28px',
            fontWeight: 700,
            fontSize: 14.5,
          }}
        >
          {brand.sections.story_cta}
        </Link>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <main style={{ flex: 1 }} aria-busy="true" aria-label="Memuat beranda">
      <section style={{ ...wrap, padding: '48px 20px 40px', display: 'flex', flexWrap: 'wrap', gap: 40 }}>
        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <Skeleton height={22} width={180} radius={999} />
          <Skeleton height={54} style={{ marginTop: 18 }} />
          <Skeleton height={54} width="70%" style={{ marginTop: 10 }} />
          <Skeleton height={16} width="90%" style={{ marginTop: 20 }} />
          <Skeleton height={46} width={190} radius={999} style={{ marginTop: 26 }} />
        </div>
        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <Skeleton ratio="4/5" radius={22} style={{ maxWidth: 300, margin: '0 auto' }} />
        </div>
      </section>
      <section style={{ ...wrap, padding: '10px 20px 48px' }}>
        <ProductGridSkeleton count={4} />
      </section>
    </main>
  );
}

function EmptyHome() {
  return (
    <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '80px 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 34,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Koleksi sedang disiapkan
        </h1>
        <p style={{ color: '#8A7D70', fontSize: 15, lineHeight: 1.7, margin: '12px 0 24px' }}>
          Belum ada yang ditampilkan di beranda. Katalognya tetap bisa dijelajahi.
        </p>
        <Link
          className="hv-dark"
          to="/katalog"
          style={{
            display: 'inline-block',
            background: '#43382E',
            color: '#FFFDF7',
            borderRadius: 999,
            padding: '13px 28px',
            fontWeight: 700,
            fontSize: 14.5,
          }}
        >
          Lihat katalog
        </Link>
      </div>
    </main>
  );
}
