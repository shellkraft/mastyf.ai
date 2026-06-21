export default function CertifiedPackageLoading() {
  return (
    <main className="socket-main" style={{ paddingTop: '2rem' }}>
      <div className="socket-pkg-header">
        <div className="score-ring-skeleton" aria-hidden />
        <div style={{ flex: 1 }}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-line skeleton-badge" />
          <p className="certified-meta">Analyzing package security…</p>
        </div>
      </div>
    </main>
  );
}
