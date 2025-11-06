import { useEffect, useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { TbSparkles } from 'react-icons/tb';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { Dashboard, DashboardComponentLayout, Component } from '../types/schema';
import * as componentService from '../services/componentService';
import * as dashboardService from '../services/dashboardService';
import EmptyPreview from '../components/EmptyPreview';

interface DashboardIdEditProps {
  dashboard: Dashboard;
  onDashboardUpdate: (dashboard: Dashboard) => void;
}

// Grid constants
const GRID_COLS = 12;
const GRID_CELL_WIDTH = 80;
const GRID_CELL_HEIGHT = 100;
const GRID_CANVAS_HEIGHT = 2400; // Height of the canvas in pixels (about 3x viewport height)

// Default component sizes based on type
const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  llm: { width: 4, height: 3 },
  code: { width: 4, height: 3 },
};

// Format dashboard title with timestamp
function formatDashboardTitle(createdAt: string): string {
  const date = new Date(createdAt);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  const formatted = date.toLocaleString('en-US', options);
  return `Dashboard - ${formatted}`;
}

export default function DashboardIdEdit({ 
  dashboard, 
  onDashboardUpdate 
}: DashboardIdEditProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [layout, setLayout] = useState<DashboardComponentLayout[]>(dashboard.layout);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);

  useEffect(() => {
    loadComponents();
  }, []);

  useEffect(() => {
    setLayout(dashboard.layout);
  }, [dashboard.layout]);

  async function loadComponents() {
    const data = await componentService.fetchComponents();
    // Filter to only published components
    const published = data.filter(c => c.status === 'published');
    setComponents(published);
  }

  // Update parent's local state (no database save until Publish is clicked)
  const updateLayout = useCallback((newLayout: DashboardComponentLayout[]) => {
    const updatedDashboard: Dashboard = {
      ...dashboard,
      layout: newLayout
    };
    onDashboardUpdate(updatedDashboard);
  }, [dashboard, onDashboardUpdate]);

  function handleAddComponent(component: Component) {
    // Check if component already exists in layout - if so, do nothing
    const existsInLayout = layout.some(item => item.componentId === component.id);
    if (existsInLayout) {
      return; // Silent rejection - don't change any state
    }

    const defaultSize = DEFAULT_SIZES[component.component_type] || { width: 4, height: 3 };
    
    const newLayoutItem: DashboardComponentLayout = {
      componentId: component.id,
      x: 0,
      y: 0,
      width: defaultSize.width,
      height: defaultSize.height,
      zIndex: layout.length
    };

    const newLayout = [...layout, newLayoutItem];
    setLayout(newLayout);
    setSelectedComponentId(component.id);
    updateLayout(newLayout);
  }

  function handleUpdateLayoutItem(
    componentId: string,
    updates: Partial<DashboardComponentLayout>
  ) {
    const newLayout = layout.map(item =>
      item.componentId === componentId
        ? { ...item, ...updates }
        : item
    );
    setLayout(newLayout);
    updateLayout(newLayout);
  }

  function handleDeleteComponent(componentId: string) {
    const newLayout = layout.filter(item => item.componentId !== componentId);
    setLayout(newLayout);
    setSelectedComponentId(null);
    updateLayout(newLayout);
  }

  function getComponentById(id: string): Component | undefined {
    return components.find(c => c.id === id);
  }

  async function handleGenerateTitle() {
    setGeneratingTitle(true);
    
    try {
      // Check if dashboard is empty - no network call needed
      if (layout.length === 0) {
        const title = formatDashboardTitle(dashboard.createdAt);
        const updatedDashboard: Dashboard = {
          ...dashboard,
          dashboard_title: title
        };
        onDashboardUpdate(updatedDashboard);
        setGeneratingTitle(false);
        return; // Early return - no API call
      }
      
      // Has components - call AI API
      const result = await dashboardService.generateDashboardTitle(dashboard.id);
      
      console.log('💭 AI Thinking:', result.thinking);
      
      const updatedDashboard: Dashboard = {
        ...dashboard,
        dashboard_title: result.title
      };
      
      onDashboardUpdate(updatedDashboard);
    } catch (error) {
      console.error('Failed to generate title:', error);
      alert('Failed to generate title. Please try again.');
    } finally {
      setGeneratingTitle(false);
    }
  }

  function handleTitleChange(newTitle: string) {
    const updatedDashboard: Dashboard = {
      ...dashboard,
      dashboard_title: newTitle
    };
    onDashboardUpdate(updatedDashboard);
  }

  return (
    <PanelGroup direction="horizontal" autoSaveId="dashboard-editor-layout">
      {/* Canvas Area */}
      <Panel defaultSize={70} minSize={50} maxSize={85}>
        <div className="h-full overflow-auto bg-gray-50 relative">
        {/* Grid Overlay */}
        <div 
          className="relative mx-auto mt-4"
          style={{ 
            width: GRID_COLS * GRID_CELL_WIDTH,
            minHeight: `${GRID_CANVAS_HEIGHT}px`,
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent ${GRID_CELL_HEIGHT - 1}px, #e5e7eb ${GRID_CELL_HEIGHT - 1}px, #e5e7eb ${GRID_CELL_HEIGHT}px),
              repeating-linear-gradient(90deg, transparent, transparent ${GRID_CELL_WIDTH - 1}px, #e5e7eb ${GRID_CELL_WIDTH - 1}px, #e5e7eb ${GRID_CELL_WIDTH}px)
            `,
            backgroundSize: `${GRID_CELL_WIDTH}px ${GRID_CELL_HEIGHT}px`
          }}
        >
          {/* Empty State */}
          {layout.length === 0 && (
            <div className="absolute inset-x-0 flex justify-center" style={{ top: '300px' }}>
              <div className="text-center">
                <p className="text-lg text-gray-500">Drop components here</p>
                <p className="mt-2 text-sm text-gray-400">
                  Click components from the library to add them →
                </p>
              </div>
            </div>
          )}

          {/* Render Components */}
          {layout.map((item) => {
            const component = getComponentById(item.componentId);
            if (!component) return null;

            const isSelected = selectedComponentId === item.componentId;

            return (
              <Rnd
                key={item.componentId}
                size={{
                  width: item.width * GRID_CELL_WIDTH,
                  height: item.height * GRID_CELL_HEIGHT
                }}
                position={{
                  x: item.x * GRID_CELL_WIDTH,
                  y: item.y * GRID_CELL_HEIGHT
                }}
                onDragStop={(_e, d) => {
                  handleUpdateLayoutItem(item.componentId, {
                    x: Math.round(d.x / GRID_CELL_WIDTH),
                    y: Math.round(d.y / GRID_CELL_HEIGHT)
                  });
                }}
                onResizeStop={(_e, _dir, ref, _delta, position) => {
                  handleUpdateLayoutItem(item.componentId, {
                    width: Math.round(ref.offsetWidth / GRID_CELL_WIDTH),
                    height: Math.round(ref.offsetHeight / GRID_CELL_HEIGHT),
                    x: Math.round(position.x / GRID_CELL_WIDTH),
                    y: Math.round(position.y / GRID_CELL_HEIGHT)
                  });
                }}
                dragGrid={[GRID_CELL_WIDTH, GRID_CELL_HEIGHT]}
                resizeGrid={[GRID_CELL_WIDTH, GRID_CELL_HEIGHT]}
                minWidth={GRID_CELL_WIDTH}
                minHeight={GRID_CELL_HEIGHT}
                bounds="parent"
                onClick={() => setSelectedComponentId(item.componentId)}
                className={`cursor-move ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="h-full w-full relative overflow-hidden rounded-lg">
                  {/* Full-screen Component Preview */}
                  <EmptyPreview 
                    type="component" 
                    text=""
                    flexible={true}
                    overlayTitle={component.component_title}
                    overlaySubtitle={component.component_type}
                  />
                  
                  {/* Delete Button - Only visible when selected */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComponent(item.componentId);
                      }}
                      className="absolute top-3 right-3 z-20 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg hover:shadow-xl border border-gray-200 hover:border-red-500"
                      title="Remove component"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </Rnd>
            );
          })}
        </div>
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors cursor-col-resize" />

      {/* Component Library Sidebar */}
      <Panel defaultSize={30} minSize={20} maxSize={40}>
        <div className="h-full border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            {/* Dashboard Metadata */}
            <div className="mb-6">
              {/* Dashboard Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Dashboard Title
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dashboard.dashboard_title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-gray-900 focus:outline-none"
                    placeholder="e.g. Sales Call Analysis"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    <div className="h-5 w-px bg-gray-300" />
                    <button
                      onClick={handleGenerateTitle}
                      disabled={generatingTitle}
                      className="group rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      title={generatingTitle ? 'Generating title...' : 'Generate dashboard title'}
                    >
                      <TbSparkles className={`h-5 w-5 ${generatingTitle ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Components Section */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Components</h2>
          
          {components.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              No published components yet
            </div>
          ) : (
              <div className="space-y-3">
                {components.map((component) => (
                  <div
                    key={component.id}
                    onClick={() => handleAddComponent(component)}
                    className="cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-gray-400 transition-all"
                    style={{ height: '120px' }}
                  >
                    <EmptyPreview 
                      type="component" 
                      text=""
                      flexible={true}
                      overlayTitle={component.component_title}
                      overlaySubtitle={component.component_type}
                    />
                  </div>
                ))}
              </div>
          )}
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}

