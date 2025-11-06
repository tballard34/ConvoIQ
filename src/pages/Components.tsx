import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Component } from '../types/schema';
import * as componentService from '../services/componentService';
import EmptyPreview from '../components/EmptyPreview';

export default function Components() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    setLoading(true);
    const data = await componentService.fetchComponents();
    // Filter to only published components
    const published = data.filter(c => c.status === 'published');
    // Sort by createdAt descending (newest first)
    const sortedData = published.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setComponents(sortedData);
    setLoading(false);
  }

  async function handleAddComponent() {
    try {
      const newId = await componentService.createDraftComponent();
      navigate(`/components/${newId}`);
    } catch (error) {
      console.error('Failed to create component:', error);
      alert('Failed to create component');
    }
  }

  return (
    <div className="flex h-full flex-col p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Components</h1>
        <button
          onClick={handleAddComponent}
          className="rounded-lg bg-gray-900 px-6 py-2 font-semibold text-white transition hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      {/* Grid of components */}
      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : components.length === 0 ? (
        <div className="text-center text-gray-500">
          No components yet. Click the <span className="font-semibold">Add</span> button above to create your first component.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {components.map((component) => (
            <div 
              key={component.id} 
              className="flex cursor-pointer flex-col transition hover:opacity-80"
              onClick={() => navigate(`/components/${component.id}`)}
            >
              {/* Component preview placeholder */}
              <EmptyPreview type="component" />
              
              {/* Component title */}
              <h3 className="mt-3 text-center font-medium text-gray-900">
                {component.component_title}
              </h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

