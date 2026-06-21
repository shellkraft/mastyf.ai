type Props = {
  size?: number;
  className?: string;
};

/** mastyf.ai logo mark — shared by sidebar, login card, and loading shell. */
export function BrandLogo({ size = 52, className = '' }: Props) {
  return (
    <div
      className={`sidebar-logo ${className}`.trim()}
      style={size !== 52 ? { width: size, height: size } : undefined}
    >
      <img
        src="/dashboard-spa/logo.jpeg"
        alt="mastyf.ai"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}
