import { Img, SIZES } from '../ui/Img.jsx';
import { useConfig } from '../config/ConfigProvider.jsx';

export default function About() {
  const { brand } = useConfig();
  // The About portrait reuses the second hero image rather than a hardcoded
  // file, so a second tenant gets its own photograph here too.
  const portrait = brand.heroImages[1] ?? brand.heroImages[0];

  return (
    <main
      aria-label="Tentang Lily Alora"
      style={{ flex: 1, maxWidth: 1000, margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'center' }}>
        <Img
          src={portrait?.url}
          srcSet={portrait?.srcset}
          alt={portrait?.alt || brand.wordmark_primary}
          ratio="4/5"
          sizes={SIZES.hero}
          style={{
            flex: '1 1 320px',
            minWidth: 280,
            maxWidth: 440,
            borderRadius: '200px 200px 24px 24px',
            border: '8px solid #FDF6E3',
          }}
        />
        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#B49E6A',
            }}
          >
            Cerita kami
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 'clamp(34px,5vw,48px)',
              fontWeight: 600,
              margin: '10px 0 14px',
            }}
          >
            Lily Alora
          </h1>
          <p style={{ color: '#8A7D70', fontSize: 16, lineHeight: 1.75, margin: '0 0 14px' }}>
            Nama <em>Lily Alora</em> mencerminkan harapan dan kebahagiaan bagi siapa pun yang
            memakainya. Kami percaya satu helai kerudung bisa membawa sejuta kebahagiaan — itulah
            janji kami di setiap produk.
          </p>
          <p style={{ color: '#8A7D70', fontSize: 16, lineHeight: 1.75, margin: '0 0 22px' }}>
            Lahir di Pekalongan, kota batik yang penuh warna, kami memilih palet khas butter yellow
            dan pink muda: hangat, manis, dan penuh senyuman.
          </p>

          <div
            style={{ background: '#FDF6E3', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Kunjungi kami</div>
            <div style={{ color: '#8A7D70', fontSize: 14.5, lineHeight: 1.7 }}>
              {brand.address_line1}
              <br />
              {brand.address_line2}
              <br />
              Email: {brand.email}
            </div>
          </div>

          {brand.whatsapp_url ? (
          <a
            className="hv-primary"
            href={brand.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#D26E8E',
              color: '#fff',
              borderRadius: 999,
              padding: '13px 28px',
              fontWeight: 700,
              fontSize: 14.5,
            }}
          >
            {brand.whatsapp_text}
          </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
