import Link from 'next/link';

export default function AccessDenied() {
  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '3rem', color: '#ff4d4f' }}>403</h1>
      <h2>Access Denied</h2>
      <p>You do not have permission to view this page.</p>
      <Link href="/home" style={{ color: '#1890ff', textDecoration: 'underline' }}>
        Back to Home
      </Link>
    </div>
  );
}
