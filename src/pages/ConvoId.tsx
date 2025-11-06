import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TbSparkles } from 'react-icons/tb';
import type { Conversation } from '../types/schema';
import * as conversationService from '../services/conversationService';
import EmptyPreview from '../components/EmptyPreview';

interface TranscriptSegment {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return 'N/A';
  return num.toLocaleString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ConvoId() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [localTitle, setLocalTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadConversation();
  }, [id]);

  async function loadConversation() {
    if (!id) return;
    
    setLoading(true);
    const data = await conversationService.fetchConversationById(id);
    if (data) {
      setConversation(data);
      setLocalTitle(data.convo_title || 'New Convo');
      // Load video URL
      if (data.convo_video_s3_link) {
        const url = await conversationService.getS3ViewUrl(data.convo_video_s3_link);
        setVideoUrl(url);
      }
      // Load transcript
      loadTranscript(data);
    }
    setLoading(false);
  }

  async function loadTranscript(convo: Conversation) {
    if (!convo.convo_json_transcript_s3_link) {
      setLoadingTranscript(false);
      return;
    }

    try {
      setLoadingTranscript(true);
      const transcriptUrl = await conversationService.getS3ViewUrl(convo.convo_json_transcript_s3_link);
      
      if (transcriptUrl) {
        const response = await fetch(transcriptUrl);
        const data = await response.json();
        setTranscript(data);
      }
    } catch (error) {
      console.error('Failed to load transcript:', error);
    } finally {
      setLoadingTranscript(false);
    }
  }

  // Debounced auto-save for title
  useEffect(() => {
    if (!conversation || localTitle === conversation.convo_title) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer for 1 second
    saveTimerRef.current = setTimeout(async () => {
      if (localTitle.trim() === '') return;
      
      setIsSaving(true);
      try {
        const updatedConversation = {
          ...conversation,
          convo_title: localTitle
        };
        await conversationService.updateConversation(updatedConversation);
        setConversation(updatedConversation);
      } catch (error) {
        console.error('Failed to save title:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [localTitle, conversation]);

  async function handleGenerateTitle() {
    if (!conversation) return;
    
    setGeneratingTitle(true);
    
    try {
      const result = await conversationService.generateConversationTitle(conversation.id);
      
      console.log('💭 AI Thinking:', result.thinking);
      setLocalTitle(result.title);
    } catch (error) {
      console.error('Failed to generate title:', error);
      alert('Failed to generate title. Please try again.');
    } finally {
      setGeneratingTitle(false);
    }
  }

  async function handleDelete() {
    if (!conversation) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${conversation.convo_title}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setDeleting(true);
    
    try {
      await conversationService.deleteConversation(conversation.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!conversation) {
    return <div className="flex h-full items-center justify-center text-gray-500">Conversation not found</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {conversation.convo_title}
          </h1>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Main Content - Split View */}
      <PanelGroup direction="horizontal" autoSaveId="convo-layout">
        {/* Left Panel - Video and Metadata */}
        <Panel defaultSize={70} minSize={50}>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-4xl">
              {/* Editable Title */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Conversation Title
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-12 focus:border-gray-900 focus:outline-none"
                    placeholder="e.g. Sales Call with Client"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {isSaving && (
                      <span className="text-xs text-gray-500">Saving...</span>
                    )}
                    <div className="h-5 w-px bg-gray-300" />
                    <button
                      onClick={handleGenerateTitle}
                      disabled={generatingTitle}
                      className="group rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      title={generatingTitle ? 'Generating title...' : 'Generate conversation title with AI'}
                    >
                      <TbSparkles className={`h-6 w-6 ${generatingTitle ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Player */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-900">
                <EmptyPreview type="video" />
                {videoUrl && (
                  <video
                    src={videoUrl}
                    controls
                    className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
                      videoLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoadedData={() => setVideoLoaded(true)}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>

              {/* Metadata Cards */}
              <div className="mt-8 grid grid-cols-4 gap-6">
                {/* Duration */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatDuration(conversation.video_duration_seconds)}
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-500">Duration</div>
                </div>

                {/* Words */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatNumber(conversation.word_count)}
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-500">Words</div>
                </div>

                {/* Characters */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatNumber(conversation.char_count)}
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-500">Characters</div>
                </div>

                {/* Speakers */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatNumber(conversation.num_speakers)}
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-500">Speakers</div>
                </div>
              </div>

              {/* Created Date */}
              <div className="mt-6 text-center text-sm text-gray-500">
                Created: {formatDate(conversation.createdAt)}
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors cursor-col-resize" />

        {/* Right Panel - Transcript */}
        <Panel defaultSize={30} minSize={20} maxSize={50}>
          <div className="flex h-full flex-col border-l border-gray-200 bg-white">
            {/* Fixed Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
            </div>

            {/* Scrollable Transcript Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingTranscript ? (
                <div className="text-sm text-gray-500">Loading transcript...</div>
              ) : transcript.length === 0 ? (
                <div className="text-sm text-gray-500">No transcript available</div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((segment, index) => (
                    <div key={index} className="text-sm">
                      {/* Speaker and Timestamp */}
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">
                          Speaker {segment.speaker}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(segment.start)}
                        </span>
                      </div>
                      {/* Transcript Text */}
                      <div className="text-gray-700 leading-relaxed">
                        {segment.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Footer - Total Talk Segments */}
            {!loadingTranscript && transcript.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                <div className="text-sm text-gray-600">
                  Total Talk Segments: {transcript.length}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

