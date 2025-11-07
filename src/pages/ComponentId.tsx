import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TbSparkles } from 'react-icons/tb';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { Component, Conversation } from '../types/schema';
import * as componentService from '../services/componentService';
import * as conversationService from '../services/conversationService';
import * as componentRunService from '../services/componentRunService';
import Dropdown from '../components/Dropdown';
import Agent from '../components/Agent';
import EmptyPreview from '../components/EmptyPreview';
import { DynamicComponent } from '../lib/renderComponent';

// Resizable container component
function ResizableContainer({ 
  children, 
  minHeight = 100, 
  initialHeight = 200,
  onAutoExpand
}: { 
  children: React.ReactNode; 
  minHeight?: number; 
  initialHeight?: number;
  onAutoExpand?: () => number | null;
}) {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (!isResizing) {
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
        scrollRAFRef.current = null;
      }
      return;
    }

    const SCROLL_THRESHOLD = 100; // Start scrolling when within 100px of bottom
    const SCROLL_SPEED = 8; // Medium speed

    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      currentMouseY = e.clientY;
      
      // Handle resize
      const deltaY = e.clientY - startYRef.current;
      const newHeight = Math.max(minHeight, startHeightRef.current + deltaY);
      setHeight(newHeight);
    };

    const autoScroll = () => {
      // Find the scrollable parent
      const scrollContainer = containerRef.current?.closest('[class*="overflow-y-auto"]') as HTMLElement;
      
      if (scrollContainer && isResizing) {
        const scrollRect = scrollContainer.getBoundingClientRect();
        const distanceFromBottom = scrollRect.bottom - currentMouseY;

        if (distanceFromBottom > 0 && distanceFromBottom < SCROLL_THRESHOLD) {
          // We're in the hot zone - calculate scroll speed based on proximity
          const intensity = (SCROLL_THRESHOLD - distanceFromBottom) / SCROLL_THRESHOLD;
          const speed = intensity * SCROLL_SPEED;
          scrollContainer.scrollTop += speed;
        }
      }

      scrollRAFRef.current = requestAnimationFrame(autoScroll);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    scrollRAFRef.current = requestAnimationFrame(autoScroll);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [isResizing, minHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAutoExpand) {
      const contentHeight = onAutoExpand();
      if (contentHeight !== null) {
        setHeight(Math.max(minHeight, contentHeight));
      }
    }
  };

  return (
    <div ref={containerRef} className="relative" style={{ height: `${height}px` }}>
      {children}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className="absolute bottom-0 right-0 flex h-4 w-4 cursor-ns-resize items-center justify-center text-gray-400 hover:text-gray-600"
        title="Drag to resize, double-click to auto-fit"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="6" cy="2" r="0.8" />
          <circle cx="6" cy="6" r="0.8" />
          <circle cx="6" cy="10" r="0.8" />
        </svg>
      </div>
    </div>
  );
}

export default function ComponentId() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [component, setComponent] = useState<Component | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvoId, setSelectedConvoId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGenerateSuccess, setLastGenerateSuccess] = useState(false);
  const [generatedData, setGeneratedData] = useState<string | null>(null); // JSON string from ComponentRun

  // Monaco Editor refs
  const promptEditorRef = useRef<any>(null);
  const structuredOutputEditorRef = useRef<any>(null);
  const uiCodeEditorRef = useRef<any>(null);

  // Debug: Log state changes
  console.log('🔍 ComponentId render - selectedConvoId:', selectedConvoId);
  console.log('🔍 Button disabled?', generating || lastGenerateSuccess);

  // Configure Monaco for JSX/React support
  function handleMonacoBeforeMount(monaco: Monaco) {
    // Configure TypeScript to understand JSX/React
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      reactNamespace: 'React',
      allowNonTsExtensions: true,
      allowJs: true,
      target: monaco.languages.typescript.ScriptTarget.Latest,
    });

    // Add React type definitions (minimal, just to avoid errors)
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `declare namespace React {
        type ReactNode = any;
        type CSSProperties = any;
        function createElement(type: any, props?: any, ...children: any[]): any;
      }
      declare var React: any;`,
      'ts:react.d.ts'
    );
  }

  useEffect(() => {
    loadComponent();
    loadConversations();
  }, [id]);

  async function loadComponent() {
    if (!id) return;
    
    setLoading(true);
    const data = await componentService.fetchComponentById(id);
    if (data) {
      setComponent(data);
    }
    setLoading(false);
  }

  async function loadConversations() {
    const data = await conversationService.fetchConversations();
    setConversations(data);
    
    // Default to first conversation if available
    if (data && data.length > 0 && !selectedConvoId) {
      setSelectedConvoId(data[0]!.id);
    }
  }

  function updateField<K extends keyof Component>(field: K, value: Component[K]) {
    if (!component) return;
    setComponent({ ...component, [field]: value });
  }

  async function handlePublish() {
    if (!component) return;
    
    setPublishing(true);
    
    try {
      const updatedComponent: Component = {
        ...component,
        status: 'published'
      };
      
      await componentService.updateComponent(updatedComponent);
      setComponent(updatedComponent);
      console.log('Component published');
      
      setPublishing(false);
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 2000);
    } catch (error) {
      console.error('Failed to publish component:', error);
      alert('Failed to publish component');
      setPublishing(false);
    }
  }

  async function handleGenerateTitle() {
    if (!component) return;
    
    setGeneratingTitle(true);
    
    try {
      const result = await componentService.generateComponentTitle(
        component.prompt || '',
        component.structuredOutput || '',
        component.uiCode || ''
      );
      
      console.log('💭 AI Thinking:', result.thinking);
      updateField('component_title', result.title);
    } catch (error) {
      console.error('Failed to generate title:', error);
    } finally {
      setGeneratingTitle(false);
    }
  }

  async function handleGenerate() {
    if (!component || !selectedConvoId) return;
    
    // Reset states and start generating
    setGenerating(true);
    setGenerateError(null);
    setLastGenerateSuccess(false);
    setGeneratedData(null); // Clear previous data
    
    try {
      const result = await componentRunService.generateComponentData(
        component.id,
        selectedConvoId
      );
      
      if (result.status === 'succeeded') {
        console.log('✅ Component data generated successfully');
        console.log('📊 Generated data:', result.generatedData);
        
        // Store the generated data for rendering
        const dataJson = typeof result.generatedData === 'string' 
          ? result.generatedData 
          : JSON.stringify(result.generatedData);
        setGeneratedData(dataJson);
        
        // Show success feedback
        setLastGenerateSuccess(true);
        setTimeout(() => setLastGenerateSuccess(false), 2000);
      } else {
        // Handle failure
        const errorMsg = result.errorMessage || 'Generation failed';
        console.error('❌ Generation failed:', errorMsg);
        setGenerateError(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Generation error:', error);
      setGenerateError(error.message || 'Unknown error occurred');
    } finally {
      setGenerating(false);
    }
  }

  function handleFormatStructuredOutput() {
    structuredOutputEditorRef.current?.getAction('editor.action.formatDocument')?.run();
  }

  function handleFormatUICode() {
    uiCodeEditorRef.current?.getAction('editor.action.formatDocument')?.run();
  }

  // Auto-expand functions
  function getPromptContentHeight() {
    const editor = promptEditorRef.current;
    if (editor) {
      const contentHeight = editor.getContentHeight();
      return Math.min(contentHeight + 10, 800); // Cap at 800px, add small padding
    }
    return null;
  }

  function getStructuredOutputContentHeight() {
    const editor = structuredOutputEditorRef.current;
    if (editor) {
      const contentHeight = editor.getContentHeight();
      return Math.min(contentHeight + 10, 800); // Cap at 800px, add small padding
    }
    return null;
  }

  function getUICodeContentHeight() {
    const editor = uiCodeEditorRef.current;
    if (editor) {
      const contentHeight = editor.getContentHeight();
      return Math.min(contentHeight + 10, 800); // Cap at 800px, add small padding
    }
    return null;
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!component) {
    return <div className="flex h-full items-center justify-center text-gray-500">Component not found</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            onClick={() => navigate('/components')}
            className="flex-shrink-0 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {component.component_title || 'Untitled Component'}
          </h1>
          
          {component.status === 'draft' && (
            <span className="flex-shrink-0 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
              Draft
            </span>
          )}
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing || justPublished}
          className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {justPublished && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {publishing ? 'Publishing...' : justPublished ? 'Published' : 'Publish'}
        </button>
      </div>

      {/* Main Content - 3 column layout */}
      <PanelGroup direction="horizontal" autoSaveId="component-editor-layout">
        {/* Configuration Panel */}
        <Panel defaultSize={30} minSize={15} maxSize={50}>
          <div className="flex h-full flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white px-4 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>

          {/* Component Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Component Title
            </label>
            <div className="relative">
              <input
                type="text"
                value={component.component_title}
                onChange={(e) => updateField('component_title', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 focus:border-gray-900 focus:outline-none"
                placeholder="e.g. Call Summary"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <div className="h-5 w-px bg-gray-300" />
                <button
                  onClick={handleGenerateTitle}
                  disabled={generatingTitle}
                  className="group rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  title={generatingTitle ? 'Generating title...' : 'Generate component title with AI'}
                >
                  <TbSparkles className={`h-6 w-6 ${generatingTitle ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Component Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Component Type
            </label>
            <select
              value="llm"
              disabled
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus:border-gray-900 focus:outline-none"
            >
              <option value="llm">LLM</option>
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Prompt
            </label>
            <ResizableContainer 
              initialHeight={150} 
              minHeight={80}
              onAutoExpand={getPromptContentHeight}
            >
              <div className="h-full overflow-hidden rounded-lg border border-gray-300">
                <Editor
                  height="100%"
                  defaultLanguage="plaintext"
                  value={component.prompt || ''}
                  onChange={(value) => updateField('prompt', value || '')}
                  onMount={(editor) => promptEditorRef.current = editor}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'off',
                    glyphMargin: false,
                    folding: false,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 0,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    wrappingIndent: 'none',
                    automaticLayout: true,
                    renderLineHighlight: 'none',
                    padding: { top: 8, bottom: 8 },
                    scrollbar: {
                      vertical: 'auto',
                      horizontal: 'hidden',
                      verticalScrollbarSize: 8,
                    },
                  }}
                />
              </div>
            </ResizableContainer>
          </div>

          {/* Structured Output */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Data
              </label>
              <button
                onClick={handleFormatStructuredOutput}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Prettify
              </button>
            </div>
            <ResizableContainer 
              initialHeight={200} 
              minHeight={100}
              onAutoExpand={getStructuredOutputContentHeight}
            >
              <div className="h-full overflow-hidden rounded-lg border border-gray-300">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={component.structuredOutput || ''}
                  onChange={(value) => updateField('structuredOutput', value || '')}
                  onMount={(editor) => structuredOutputEditorRef.current = editor}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 2,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                    formatOnPaste: true,
                    formatOnType: true,
                    automaticLayout: true,
                  }}
                />
              </div>
            </ResizableContainer>
          </div>

          {/* UI Code */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                UI Code
              </label>
              <button
                onClick={handleFormatUICode}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Prettify
              </button>
            </div>
            <ResizableContainer 
              initialHeight={250} 
              minHeight={100}
              onAutoExpand={getUICodeContentHeight}
            >
              <div className="h-full overflow-hidden rounded-lg border border-gray-300">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={component.uiCode || ''}
                  onChange={(value) => updateField('uiCode', value || '')}
                  onMount={(editor) => uiCodeEditorRef.current = editor}
                  beforeMount={handleMonacoBeforeMount}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 2,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                    formatOnPaste: true,
                    formatOnType: true,
                    automaticLayout: true,
                  }}
                />
              </div>
            </ResizableContainer>
          </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors cursor-col-resize" />

        {/* Preview Panel */}
        <Panel defaultSize={45} minSize={30}>
          <div className="flex h-full flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-4 pb-4">
            <h2 className="pr-2 text-lg font-semibold text-gray-900">Preview</h2>
            <div className="flex flex-col items-end gap-2 min-w-0">
              <div className="flex items-center gap-3">
                <Dropdown
                  items={conversations}
                  value={selectedConvoId}
                  onSelect={(id) => {
                    console.log('🔍 Dropdown selected ID:', id);
                    console.log('🔍 Selected ID type:', typeof id);
                    console.log('🔍 Selected ID length:', id?.length);
                    setSelectedConvoId(id);
                  }}
                  getLabel={(convo) => convo.convo_title}
                  getId={(convo) => convo.id}
                  placeholder="Select a convo..."
                  truncateLength={20}
                  className="max-w-[200px]"
                />
                <button
                  onClick={() => {
                    console.log('🔍 Button clicked, selectedConvoId:', selectedConvoId);
                    handleGenerate();
                  }}
                  disabled={generating || lastGenerateSuccess}
                  className="whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {lastGenerateSuccess && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {generating && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {generating ? 'Generating...' : lastGenerateSuccess ? 'Generated' : 'Generate'}
                </button>
              </div>
              {generateError && (
                <div className="text-xs text-red-600">
                  {generateError}
                </div>
              )}
            </div>
          </div>

          {/* Grid Preview Area */}
          <div 
            className="relative flex-1 overflow-auto"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: '12px 12px',
              backgroundColor: '#fafafa'
            }}
          >
            {/* Centered Preview Component */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {generatedData && component.uiCode ? (
                // Render the dynamically generated component
                <div className="shadow-lg">
                  <DynamicComponent 
                    uiCode={component.uiCode}
                    generatedDataJson={generatedData}
                  />
                </div>
              ) : (
                // Show empty state when no data
                <div className="h-64 w-96 shadow-sm">
                  <EmptyPreview
                    type="component"
                    flexible={true}
                    overlayTitle={component.component_title || 'Untitled Component'}
                    overlaySubtitle={component.component_type}
                  />
                </div>
              )}
            </div>
          </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors cursor-col-resize" />

        {/* Agent Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <Agent 
            componentId={component.id}
            componentTitle={component.component_title}
            currentState={{
              prompt: component.prompt || '',
              structuredOutput: component.structuredOutput || '',
              uiCode: component.uiCode || '',
            }}
            onComponentUpdate={loadComponent}
            onStateChange={(newState) => {
              // Update component state with agent's in-memory changes
              setComponent({
                ...component,
                prompt: newState.prompt,
                structuredOutput: newState.structuredOutput,
                uiCode: newState.uiCode,
              });
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
