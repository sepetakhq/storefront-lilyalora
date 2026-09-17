import { useToastMessage } from '@sepetakhq/storefront-kit/ui/ToastProvider';

export default function Toast() {
  const message = useToastMessage();
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#43382E',
        color: '#FFFDF7',
        borderRadius: 999,
        padding: '12px 26px',
        fontWeight: 700,
        fontSize: 14,
        zIndex: 200,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      }}
    >
      {message}
    </div>
  );
}
