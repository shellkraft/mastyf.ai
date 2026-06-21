import Link from 'next/link';

type Props = {
  packageName: string;
};

export function PackageNotFound({ packageName }: Props) {
  return (
    <main className="socket-main socket-not-certified" style={{ paddingTop: '2rem' }}>
      <p className="socket-breadcrumb">
        <Link href="/certified">Security scores</Link> / {packageName}
      </p>

      <div className="socket-not-certified-hero">
        <div className="socket-not-certified-badge">
          <span className="socket-not-certified-label">Package not found</span>
        </div>
        <h1 className="socket-pkg-title">{packageName}</h1>
        <p className="socket-hero-lead" style={{ textAlign: 'left', maxWidth: '36rem' }}>
          This package name is not published on npm, or the name is invalid. Check the spelling
          (scoped packages use <code>@scope/name</code>) and try again.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/certified">← Back to lookup</Link>
        </p>
      </div>
    </main>
  );
}
