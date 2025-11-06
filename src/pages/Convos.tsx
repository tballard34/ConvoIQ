import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import type { Conversation } from '../types/schema';
import * as conversationService from '../services/conversationService';
import EmptyPreview from '../components/EmptyPreview';

function ThumbnailImage({ conversation }: { conversation: Conversation }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    async function loadThumbnail() {
      if (conversation.convo_thumbnail_s3_link) {
        const url = await conversationService.getS3ViewUrl(conversation.convo_thumbnail_s3_link);
        setThumbnailUrl(url);
      }
    }
    loadThumbnail();
  }, [conversation.convo_thumbnail_s3_link]);

  return (
    <div className="relative aspect-video w-full">
      <EmptyPreview type="video" />
      {thumbnailUrl && (
        <img 
          src={thumbnailUrl} 
          alt={conversation.convo_title}
          className={`absolute inset-0 h-full w-full rounded-lg object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
        />
      )}
    </div>
  );
}

export default function Convos() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    const data = await conversationService.fetchConversations();
    // Sort by createdAt descending (newest first)
    const sortedData = data.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setConversations(sortedData);
    setLoading(false);
  }

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setShowUploadModal(false);

    try {
      await conversationService.uploadConversation(file);
      await loadConversations(); // Refresh the list
    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert('Upload failed! Check console for details.');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false
  });

  return (
    <div className="flex h-full flex-col p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Convos</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="rounded-lg bg-gray-900 px-6 py-2 font-semibold text-white transition hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      {/* Upload Modal Overlay */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="mx-4 w-full max-w-2xl rounded-2xl border-2 border-gray-900 bg-white p-16 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              {...getRootProps()}
              className={`flex h-96 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition ${
                isDragActive
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-400 hover:border-gray-600'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-center">
                {isDragActive ? (
                  <p className="text-2xl font-medium text-gray-900">Drop your video here</p>
                ) : (
                  <p className="text-2xl font-medium text-gray-900">Add a video of a conversation</p>
                )}
                <p className="mt-4 text-sm text-gray-500">
                  Drag & drop a video file or click to browse
                </p>
                <p className="mt-2 text-xs text-gray-400">MP4 only • Max 500MB</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid of conversations */}
      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center text-gray-500">
          No conversations yet. Click the <span className="font-semibold">Add</span> button above to create your first conversation.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {conversations.map((convo) => (
            <div 
              key={convo.id} 
              className="flex flex-col cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => navigate(`/convos/${convo.id}`)}
            >
              {/* Video thumbnail */}
              <ThumbnailImage conversation={convo} />
              
              {/* Conversation title */}
              <h3 className="mt-3 text-center font-medium text-gray-900">
                {convo.convo_title}
              </h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

