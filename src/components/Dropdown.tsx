import { useEffect, useRef, useState } from 'react';
import { TbChevronDown } from 'react-icons/tb';

interface DropdownProps<T> {
  items: T[];
  value: string;
  onSelect: (id: string) => void;
  getLabel: (item: T) => string;
  getId: (item: T) => string;
  placeholder?: string;
  className?: string;
  truncateLength?: number;
}

export default function Dropdown<T>({
  items,
  value,
  onSelect,
  getLabel,
  getId,
  placeholder = 'Select an option...',
  className = '',
  truncateLength = 20
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  function handleSelect(id: string) {
    onSelect(id);
    setIsOpen(false);
  }

  const selectedItem = items.find(item => getId(item) === value);
  const displayText = selectedItem 
    ? truncateText(getLabel(selectedItem), truncateLength) 
    : placeholder;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:border-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
      >
        <span className={`truncate ${selectedItem ? 'text-gray-900' : 'text-gray-500'}`}>
          {displayText}
        </span>
        <TbChevronDown 
          className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-[250px] overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No items available
            </div>
          ) : (
            items.map((item) => {
              const itemId = getId(item);
              const itemLabel = getLabel(item);
              const isSelected = value === itemId;

              return (
                <button
                  key={itemId}
                  onClick={() => handleSelect(itemId)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                    isSelected ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {itemLabel}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

