import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <div className="card grid">
        <h1 style={{ margin: 0 }}>Matter not found</h1>
        <Link href="/home" className="button">
          Return to Home
        </Link>
      </div>
    </main>
  );
}
