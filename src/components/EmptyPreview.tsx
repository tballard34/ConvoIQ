import { TbBox, TbLayout } from 'react-icons/tb';

type EmptyPreviewProps = {
  type?: 'video' | 'component' | 'dashboard';
  text?: string;
};

export default function EmptyPreview({ type = 'video', text = 'No Preview' }: EmptyPreviewProps) {
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

  return (
    <div className="aspect-video w-full rounded-lg bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        {renderIcon()}
        <p className="text-sm text-gray-500">{text}</p>
      </div>
    </div>
  );
}

