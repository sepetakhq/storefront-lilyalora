import { Link } from 'react-router-dom';

import { EmptyState } from '../ui/states.jsx';

export default function NotFound() {
  return (
    <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '80px 20px' }}>
      <EmptyState
        title="Halaman tidak ditemukan"
        body="Tautannya mungkin sudah berubah. Mulai lagi dari beranda."
        action={
          <Link
            to="/"
            className="hv-dark"
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
            Ke beranda
          </Link>
        }
      />
    </main>
  );
}
