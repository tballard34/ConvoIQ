import { useEffect, useState } from 'react';
import type { Dashboard, Component } from '../types/schema';
import * as componentService from '../services/componentService';
import EmptyPreview from '../components/EmptyPreview';

interface DashboardIdViewProps {
  dashboard: Dashboard;
}

// Grid constants - matching DashboardIdEdit.tsx
const GRID_COLS = 12;
const GRID_CELL_WIDTH = 80;
const GRID_CELL_HEIGHT = 100;
const GRID_CANVAS_HEIGHT = 2400;

export default function DashboardIdView({ dashboard }: DashboardIdViewProps) {
  const [components, setComponents] = useState<Component[]>([]);

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    const data = await componentService.fetchComponents();
    // Filter to only published components
    const published = data.filter(c => c.status === 'published');
    setComponents(published);
  }

  function getComponentById(id: string): Component | undefined {
    return components.find(c => c.id === id);
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* Grid Container - Fixed width, centered, no gridlines */}
      <div 
        className="relative mx-auto mt-4"
        style={{ 
          width: GRID_COLS * GRID_CELL_WIDTH,
          minHeight: `${GRID_CANVAS_HEIGHT}px`
        }}
      >
        {/* Empty State */}
        {dashboard.layout.length === 0 && (
          <div className="absolute inset-x-0 flex justify-center" style={{ top: '300px' }}>
            <div className="text-center">
              <p className="text-lg text-gray-500">No components in this dashboard</p>
            </div>
          </div>
        )}

        {/* Render Components */}
        {dashboard.layout.map((item) => {
          const component = getComponentById(item.componentId);
          if (!component) return null;

          return (
            <div
              key={item.componentId}
              style={{
                position: 'absolute',
                left: item.x * GRID_CELL_WIDTH,
                top: item.y * GRID_CELL_HEIGHT,
                width: item.width * GRID_CELL_WIDTH,
                height: item.height * GRID_CELL_HEIGHT,
                zIndex: item.zIndex
              }}
            >
              <div className="h-full w-full overflow-hidden rounded-lg">
                <EmptyPreview 
                  type="component" 
                  text=""
                  flexible={true}
                  overlayTitle={component.component_title}
                  overlaySubtitle={component.component_type}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
