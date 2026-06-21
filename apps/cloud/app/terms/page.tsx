import Link from 'next/link';
import { CLOUD_NAME, NPM_PRODUCT_NAME } from '@/lib/product-links';

export default function TermsPage() {
  return (
    <main className="container">
      <h1>Terms of Service</h1>
      <div className="card">
        <p>
          {CLOUD_NAME} provides an optional hosted control plane for managing policies and tenant
          configuration for self-hosted {NPM_PRODUCT_NAME} deployments. The control plane sign-in is
          free and open source under MIT.
        </p>
        <p>
          The service is provided as-is. You are responsible for securing your self-hosted{' '}
          {NPM_PRODUCT_NAME} instance and API keys.
        </p>
      </div>
      <Link href="/">Back to home</Link>
    </main>
  );
}
