import { ExternalLink } from 'lucide-react';

interface PlayerLinkProps {
  name: string;
  className?: string;
  showIcon?: boolean;
}

const PlayerLink = ({ name, className = '', showIcon = false }: PlayerLinkProps) => {
  const encodedName = encodeURIComponent(name);
  const url = `https://www.tibiarelic.com/characters/${encodedName}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:text-gold hover:underline transition-colors inline-flex items-center gap-1 ${className}`}
    >
      {name}
      {showIcon && <ExternalLink className="w-3 h-3" />}
    </a>
  );
};

export default PlayerLink;
