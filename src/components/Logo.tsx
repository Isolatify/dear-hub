export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/assets/logo/DEAR_Hub_Logo-removebg-preview.png"
      alt="DEAR Hub"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

export function LogoWhite({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/assets/logo/White-removebg-preview.png"
      alt="DEAR Hub"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

export function LogoDark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/assets/logo/Black-removebg-preview.png"
      alt="DEAR Hub"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
