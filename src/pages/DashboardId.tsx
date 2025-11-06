import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Dashboard, Conversation } from '../types/schema';
import * as dashboardService from '../services/dashboardService';
import * as conversationService from '../services/conversationService';
import DashboardIdView from '../components/DashboardIdView';
import DashboardIdEdit from '../components/DashboardIdEdit';
import Dropdown from '../components/Dropdown';

export default function DashboardId() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvoId, setSelectedConvoId] = useState<string>('conv-1762362893983');

  useEffect(() => {
    loadDashboard();
    loadConversations();
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

  async function loadConversations() {
    const data = await conversationService.fetchConversations();
    setConversations(data);
  }

  function handleDashboardUpdate(updatedDashboard: Dashboard) {
    setDashboard(updatedDashboard);
  }

  async function handlePublish() {
    if (!dashboard) return;
    
    setPublishing(true);
    
    try {
      const updatedDashboard: Dashboard = {
        ...dashboard,
        status: 'published'
      };
      await dashboardService.updateDashboard(updatedDashboard);
      setDashboard(updatedDashboard);
      console.log('Dashboard published successfully');
      
      setPublishing(false);
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 2000);
    } catch (error) {
      console.error('Failed to publish dashboard:', error);
      alert('Failed to publish dashboard');
      setPublishing(false);
    }
  }

  function handleGenerate() {
    // TODO: Implement pipeline generation
    console.log('Generate dashboard clicked');
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
          
          {/* Conversation Selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Conversation:
            </label>
            <Dropdown
              items={conversations}
              value={selectedConvoId}
              onSelect={setSelectedConvoId}
              getLabel={(convo) => convo.convo_title}
              getId={(convo) => convo.id}
              placeholder="Select a convo..."
              truncateLength={30}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditMode && (
            <button
              onClick={handlePublish}
              disabled={publishing || justPublished}
              className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {justPublished && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {publishing ? 'Publishing...' : justPublished ? 'Published' : 'Publish'}
            </button>
          )}
          
          <button
            onClick={handleGenerate}
            disabled={true}
            className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:hover:bg-gray-900"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Route between View and Edit components */}
      <div className="flex-1 overflow-hidden">
        {isEditMode ? (
          <DashboardIdEdit
            dashboard={dashboard}
            onDashboardUpdate={handleDashboardUpdate}
          />
        ) : (
          <DashboardIdView
            dashboard={dashboard}
          />
        )}
      </div>
    </div>
  );
}

