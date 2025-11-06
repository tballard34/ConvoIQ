import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dashboard } from '../types/schema';
import * as dashboardService from '../services/dashboardService';
import EmptyPreview from '../components/EmptyPreview';

export default function Dashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboards();
  }, []);

  async function loadDashboards() {
    setLoading(true);
    const data = await dashboardService.fetchDashboards();
    // Filter to only published dashboards
    const published = data.filter(d => d.status === 'published');
    // Sort by createdAt descending (newest first)
    const sortedData = published.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setDashboards(sortedData);
    setLoading(false);
  }

  async function handleAddDashboard() {
    try {
      const newDashboardId = await dashboardService.createDraftDashboard();
      navigate(`/dashboards/${newDashboardId}`);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      alert('Failed to create dashboard. Check console for details.');
    }
  }

  return (
    <div className="flex h-full flex-col p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboards</h1>
        <button
          onClick={handleAddDashboard}
          className="rounded-lg bg-gray-900 px-6 py-2 font-semibold text-white transition hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      {/* Grid of dashboards */}
      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : dashboards.length === 0 ? (
        <div className="text-center text-gray-500">
          No dashboards yet. Click the <span className="font-semibold">Add</span> button above to create your first dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
            <div 
              key={dashboard.id} 
              className="flex cursor-pointer flex-col transition hover:opacity-80"
              onClick={() => navigate(`/dashboards/${dashboard.id}`)}
            >
              {/* Dashboard preview */}
              <div className="relative aspect-video w-full">
                <EmptyPreview type="dashboard" />
              </div>
              
              {/* Dashboard title */}
              <h3 className="mt-3 text-center font-medium text-gray-900">
                {dashboard.dashboard_title}
              </h3>
              
              {/* Component count */}
              <p className="text-center text-sm text-gray-500">
                {dashboard.layout.length} component{dashboard.layout.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

