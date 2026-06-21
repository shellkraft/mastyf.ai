import { CertifiedShell } from '@/components/CertifiedShell';
import './certified.css';
import './socket-certified.css';

export default function CertifiedLayout({ children }: { children: React.ReactNode }) {
  return <CertifiedShell>{children}</CertifiedShell>;
}
