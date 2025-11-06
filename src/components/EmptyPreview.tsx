import { TbBox, TbLayout } from 'react-icons/tb';

type EmptyPreviewProps = {
  type?: 'video' | 'component' | 'dashboard';
  text?: string;
  flexible?: boolean; // If true, uses h-full instead of aspect-video
  overlayTitle?: string; // If provided, shows title overlay at bottom-left
  overlaySubtitle?: string; // If provided, shows subtitle overlay at bottom-left
};

export default function EmptyPreview({ 
  type = 'video', 
  text = 'No Preview',
  flexible = false,
  overlayTitle,
  overlaySubtitle
}: EmptyPreviewProps) {
  // Different icons for different preview types - matching sidebar icons
  const renderIcon = () => {
    const iconClass = "text-gray-600";
    const iconSize = 48;
    
    switch (type) {
      case 'component':
        return <TbBox size={iconSize} className={iconClass} />;
      case 'dashboard':
        return <TbLayout size={iconSize} className={iconClass} />;
      case 'video':
      default:
        // Keep the video camera icon for convos
        return (
          <svg 
            className="h-12 w-12 text-gray-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
            />
          </svg>
        );
    }
  };

  const containerClass = flexible 
    ? "h-full w-full rounded-lg bg-gray-900 flex items-center justify-center relative"
    : "aspect-video w-full rounded-lg bg-gray-900 flex items-center justify-center relative";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center justify-center gap-2">
        {renderIcon()}
        {text && <p className="text-sm text-gray-500">{text}</p>}
      </div>
      
      {/* Overlay for title and subtitle at bottom-left */}
      {(overlayTitle || overlaySubtitle) && (
        <div className="absolute bottom-3 left-3">
          {overlayTitle && (
            <h3 className="text-sm font-medium text-white truncate">
              {overlayTitle}
            </h3>
          )}
          {overlaySubtitle && (
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {overlaySubtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

