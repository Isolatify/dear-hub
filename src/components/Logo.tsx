import { useTheme } from '@/context/ThemeContext';

export function Logo({ size = 40, className = '', forceColor }: { size?: number; className?: string; forceColor?: 'light' | 'dark' }) {
  const { theme } = useTheme();
  const useWhite = forceColor === 'light' || (!forceColor && theme.mode === 'dark');

  return (
    <img
      src={useWhite ? '/assets/logo/White-removebg-preview.png' : '/assets/logo/DEAR_Hub_Logo-removebg-preview.png'}
      alt="DEAR Hub"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = '/assets/logo/DEAR_Hub_Logo-removebg-preview.png';
      }}
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
      onError={(e) => {
        (e.target as HTMLImageElement).src = '/assets/logo/DEAR_Hub_Logo-removebg-preview.png';
      }}
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
      onError={(e) => {
        (e.target as HTMLImageElement).src = '/assets/logo/DEAR_Hub_Logo-removebg-preview.png';
      }}
    />
  );
}
