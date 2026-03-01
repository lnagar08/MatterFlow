export default function HomeLoading() {
  return (
    <main>
      <div className="app-shell">
        <div className="app-nav">
          <div className="skeleton" style={{ height: 42 }} />
          <div className="skeleton" style={{ height: 36 }} />
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="skeleton" style={{ height: 54, borderRadius: 16 }} />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card">
            <div className="skeleton" style={{ height: 18, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 6, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 14, width: "40%" }} />
          </div>
        ))}
      </div>
    </main>
  );
}
