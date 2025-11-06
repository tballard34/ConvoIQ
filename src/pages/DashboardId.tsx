import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Dashboard } from '../types/schema';
import * as dashboardService from '../services/dashboardService';

export default function DashboardId() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [id]);

  async function loadDashboard() {
    if (!id) return;
    
    setLoading(true);
    const data = await dashboardService.fetchDashboardById(id);
    if (data) {
      setDashboard(data);
      // Start in edit mode if it's a draft
      setIsEditMode(data.status === 'draft');
    }
    setLoading(false);
  }

  async function handlePublish() {
    if (!dashboard) return;
    
    try {
      const updatedDashboard: Dashboard = {
        ...dashboard,
        status: 'published'
      };
      
      await dashboardService.updateDashboard(updatedDashboard);
      setDashboard(updatedDashboard);
      setIsEditMode(false);
      console.log('Dashboard published');
    } catch (error) {
      console.error('Failed to publish dashboard:', error);
      alert('Failed to publish dashboard');
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!dashboard) {
    return <div className="flex h-full items-center justify-center text-gray-500">Dashboard not found</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex min-h-[73px] items-center justify-between border-b border-gray-200 px-8 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            onClick={() => navigate('/dashboards')}
            className="flex-shrink-0 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {dashboard.dashboard_title || 'Untitled Dashboard'}
          </h1>
          
          {/* Mode Toggle */}
          <div className="flex flex-shrink-0 rounded-lg border border-gray-300 bg-white">
            <button
              onClick={() => setIsEditMode(false)}
              className={`px-3 py-1 text-sm font-medium transition-colors rounded-l-lg ${
                !isEditMode 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              View
            </button>
            <button
              onClick={() => setIsEditMode(true)}
              className={`px-3 py-1 text-sm font-medium transition-colors rounded-r-lg ${
                isEditMode 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Edit
            </button>
          </div>
          
          {dashboard.status === 'draft' && (
            <span className="flex-shrink-0 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
              Draft
            </span>
          )}
        </div>

        <div className="flex-shrink-0" style={{ width: '89px' }}>
          {isEditMode && (
            <button
              onClick={handlePublish}
              className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        {isEditMode ? (
          // Edit Mode
          <div className="mx-auto max-w-7xl">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-lg text-gray-500">Edit Mode</p>
              <p className="mt-2 text-sm text-gray-400">
                Dashboard layout editor coming soon...
              </p>
              <p className="mt-4 text-xs text-gray-400">
                {dashboard.layout.length} component{dashboard.layout.length !== 1 ? 's' : ''} in layout
              </p>
            </div>
          </div>
        ) : (
          // View Mode
          <div className="mx-auto max-w-7xl">
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-lg text-gray-500">View Mode</p>
              <p className="mt-2 text-sm text-gray-400">
                Dashboard rendering coming soon...
              </p>
              <p className="mt-4 text-xs text-gray-400">
                {dashboard.layout.length} component{dashboard.layout.length !== 1 ? 's' : ''} in layout
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

