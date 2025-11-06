import { useState, useEffect, useRef } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { marked } from 'marked';
import { fetchConversations } from '../services/conversationService';
import { runAgent, type AgentMessage } from '../services/agentService';
import type { Conversation } from '../types/schema';

interface Example {
  title: string;
  prompt: string;
}

interface AgentProps {
  componentId: string;
  componentTitle: string;
  currentState: {
    prompt: string;
    structuredOutput: string;
    uiCode: string;
  };
  onComponentUpdate?: () => void;
  onStateChange?: (newState: { prompt: string; structuredOutput: string; uiCode: string }) => void;
}

interface ConversationRound {
  id: string;
  userPrompt: string;
  editModes: {
    editPrompt: boolean;
    editData: boolean;
    editUICode: boolean;
  };
  messages: AgentMessage[];
  timestamp: number;
}

interface SessionContext {
  conversationId: string;
  conversationTitle: string;
  initialEditModes: {
    editPrompt: boolean;
    editData: boolean;
    editUICode: boolean;
  };
}

const EXAMPLES: Example[] = [
  {
    title: 'Summary Component',
    prompt: `Create a conversation summary component that:
- Displays the main topics discussed
- Shows key decisions made
- Lists action items with owners
- Includes a brief overview paragraph
- Uses a clean card layout with sections`,
  },
  {
    title: 'Confidence Scores',
    prompt: `Create a confidence scores visualization that:
- Shows confidence levels for different metrics
- Uses progress bars or gauges for each score
- Color codes scores (green for high, yellow for medium, red for low)
- Displays percentage values
- Includes labels for each metric`,
  },
  {
    title: 'SME Scores',
    prompt: `Create an SME (Subject Matter Expert) scores dashboard that:
- Lists SMEs with their expertise areas
- Shows scoring metrics for each expert
- Displays rating bars or stars
- Includes contact information
- Highlights top performers`,
  },
];

const CHAT_INPUT_MIN_HEIGHT = 40;
const CHAT_INPUT_MAX_HEIGHT = 180;

export default function Agent({ componentId, componentTitle, currentState, onComponentUpdate, onStateChange }: AgentProps) {
  // Session state
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [conversationRounds, setConversationRounds] = useState<ConversationRound[]>([]);
  
  // UI state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Initial view state (only used before first prompt)
  const [initialInput, setInitialInput] = useState('');
  const [initialEditPrompt, setInitialEditPrompt] = useState(true);
  const [initialEditData, setInitialEditData] = useState(true);
  const [initialEditUICode, setInitialEditUICode] = useState(true);
  const [selectedConvoId, setSelectedConvoId] = useState('conv-1762362893983');
  const [showConvoDropdown, setShowConvoDropdown] = useState(false);
  
  // Chat view state (used after first prompt)
  const [chatInput, setChatInput] = useState('');
  const [chatEditPrompt, setChatEditPrompt] = useState(true);
  const [chatEditData, setChatEditData] = useState(true);
  const [chatEditUICode, setChatEditUICode] = useState(true);
  
  // Refs
  const controlsRef = useRef<HTMLDivElement>(null);
  const convoDropdownRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Responsive state for initial view
  const [isWide, setIsWide] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);

  // Load conversations
  useEffect(() => {
    fetchConversations().then(setConversations);
  }, []);

  // Handle click outside for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (convoDropdownRef.current && !convoDropdownRef.current.contains(event.target as Node)) {
        setShowConvoDropdown(false);
      }
    }

    if (showConvoDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConvoDropdown]);

  // Resize observer for initial view controls
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setIsWide(width >= 200);
        setIsNarrow(width < 166);
      }
    });
    
    if (controlsRef.current) {
      observer.observe(controlsRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom in chat view when new messages arrive
  useEffect(() => {
    if (sessionContext && conversationRounds.length > 0) {
      const container = chatMessagesContainerRef.current;
      if (container) {
        // Scroll to bottom to show newest content
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [conversationRounds, sessionContext]);

  // Auto-resize chat input textarea based on content
  useEffect(() => {
    if (!chatInputRef.current) return;

    const textarea = chatInputRef.current;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const nextHeight = Math.max(
      CHAT_INPUT_MIN_HEIGHT,
      Math.min(scrollHeight, CHAT_INPUT_MAX_HEIGHT)
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [chatInput, sessionContext]);

  const handleExampleClick = (example: Example) => {
    setInitialInput(example.prompt);
  };

  const handleInitialSubmit = async () => {
    if (!initialInput.trim()) {
      setStatusMessage('Please enter a prompt');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }

    if (!selectedConvoId) {
      setStatusMessage('Please select a conversation');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }

    const selectedConvo = conversations.find(c => c.id === selectedConvoId);
    if (!selectedConvo) {
      setStatusMessage('Invalid conversation selected');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }

    // Start the session
    setSessionContext({
      conversationId: selectedConvoId,
      conversationTitle: selectedConvo.convo_title,
      initialEditModes: {
        editPrompt: initialEditPrompt,
        editData: initialEditData,
        editUICode: initialEditUICode,
      },
    });

    // Initialize chat edit modes from initial
    setChatEditPrompt(initialEditPrompt);
    setChatEditData(initialEditData);
    setChatEditUICode(initialEditUICode);

    // Run the agent
    await runAgentPrompt(initialInput, {
      editPrompt: initialEditPrompt,
      editData: initialEditData,
      editUICode: initialEditUICode,
    }, selectedConvoId, selectedConvo.convo_title);

    // Clear initial input
    setInitialInput('');
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !sessionContext) return;

    await runAgentPrompt(chatInput, {
      editPrompt: chatEditPrompt,
      editData: chatEditData,
      editUICode: chatEditUICode,
    }, sessionContext.conversationId, sessionContext.conversationTitle);

    setChatInput('');
  };

  const runAgentPrompt = async (
    prompt: string,
    editModes: { editPrompt: boolean; editData: boolean; editUICode: boolean },
    conversationId: string,
    conversationTitle: string
  ) => {
    setIsRunning(true);
    setStatusMessage('Running agent...');

    const roundId = `round-${Date.now()}`;

    // Add round immediately with empty messages
    const placeholderRound: ConversationRound = {
      id: roundId,
      userPrompt: prompt,
      editModes,
      messages: [],
      timestamp: Date.now(),
    };
    
    setConversationRounds(prev => [...prev, placeholderRound]);

    // Track current message text being built
    let currentMessageText = '';

    try {
      await runAgent({
        componentId,
        componentTitle,
        conversationId,
        conversationTitle,
        userPrompt: prompt,
        currentState,
        editModes,
      }, (event, data) => {
        console.log('📡 SSE Event:', event, data);

        if (event === 'message_start') {
          // Start a new assistant message
          currentMessageText = '';
          
          const newMessage: AgentMessage = {
            id: data.messageId,
            type: 'assistant',
            content: '',
            timestamp: Date.now(),
          };
          
          setConversationRounds(prev => prev.map(round =>
            round.id === roundId 
              ? { ...round, messages: [...round.messages, newMessage] }
              : round
          ));
        }
        
        else if (event === 'message_chunk') {
          // Append to current message
          currentMessageText += data.delta;
          
          setConversationRounds(prev => prev.map(round =>
            round.id === roundId ? {
              ...round,
              messages: round.messages.map(msg =>
                msg.id === data.messageId
                  ? { ...msg, content: currentMessageText }
                  : msg
              )
            } : round
          ));
        }
        
        else if (event === 'message_complete') {
          // Message finished (nothing to do, already updated)
          console.log('✓ Message complete:', data.messageId);
        }
        
        else if (event === 'tool_call') {
          // Add tool call message
          const toolMessage: AgentMessage = {
            id: data.id,
            type: 'tool_call',
            content: data.toolName,
            timestamp: Date.now(),
            metadata: {
              toolName: data.toolName,
              args: data.args,
            },
          };
          
          setConversationRounds(prev => prev.map(round =>
            round.id === roundId
              ? { ...round, messages: [...round.messages, toolMessage] }
              : round
          ));
        }
        
        else if (event === 'tool_result') {
          // Add tool result message
          const resultMessage: AgentMessage = {
            id: data.id,
            type: 'tool_result',
            content: JSON.stringify(data.result, null, 2),
            timestamp: Date.now(),
            metadata: {
              toolName: data.toolName,
              result: data.result,
            },
          };
          
          setConversationRounds(prev => prev.map(round =>
            round.id === roundId
              ? { ...round, messages: [...round.messages, resultMessage] }
              : round
          ));
        }
        
        else if (event === 'agent_complete') {
          // Agent finished - update component state
          if (data.updatedState && onStateChange) {
            onStateChange(data.updatedState);
          }
          setStatusMessage('✓ Agent completed successfully');
          setTimeout(() => setStatusMessage(''), 3000);
        }
        
        else if (event === 'error') {
          // Error occurred
          const errorMessage: AgentMessage = {
            id: 'error-' + Date.now(),
            type: 'error',
            content: data.message,
            timestamp: Date.now(),
          };
          
          setConversationRounds(prev => prev.map(round =>
            round.id === roundId
              ? { ...round, messages: [...round.messages, errorMessage] }
              : round
          ));
          
          setStatusMessage(`✗ ${data.message}`);
        }
      });

      // Streaming completed successfully
      console.log('✓ Agent streaming completed');

    } catch (error: any) {
      console.error('✗ Agent error:', error);
      setStatusMessage(`✗ Error: ${error.message}`);
      
      // Update the round with error message
      setConversationRounds(prev => 
        prev.map(round => 
          round.id === roundId 
            ? { 
                ...round, 
                messages: [...round.messages, {
                  id: 'error-' + Date.now(),
                  type: 'error',
                  content: error.message,
                  timestamp: Date.now(),
                }]
              }
            : round
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  // Message display component
  const MessageDisplay = ({ message }: { message: AgentMessage }) => {
    const [expanded, setExpanded] = useState(false);

    if (message.type === 'assistant') {
      // Parse markdown to HTML
      const htmlContent = marked.parse(message.content, { async: false }) as string;
      
      return (
        <div 
          className="prose prose-sm max-w-none text-gray-900 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-gray-50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-2 [&_strong]:font-semibold [&_em]:italic [&_hr]:my-4 [&_hr]:border-gray-300"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }

    if (message.type === 'tool_call') {
      return (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm font-medium text-blue-900 w-full text-left"
          >
            {expanded ? <TbChevronDown className="h-4 w-4" /> : <TbChevronRight className="h-4 w-4" />}
            <span>🔧 {message.metadata?.toolName || message.content}</span>
          </button>
          {expanded && message.metadata?.args && (
            <pre className="mt-2 text-xs text-blue-800 overflow-x-auto">
              {JSON.stringify(message.metadata.args, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    if (message.type === 'tool_result') {
      return (
        <div className="rounded-lg bg-gray-100 border border-gray-300 px-3 py-2 ml-6">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-gray-700 w-full text-left"
          >
            {expanded ? <TbChevronDown className="h-3 w-3" /> : <TbChevronRight className="h-3 w-3" />}
            <span>Result</span>
          </button>
          {expanded && (
            <pre className="mt-2 text-xs text-gray-700 overflow-x-auto max-h-48 overflow-y-auto">
              {message.content}
            </pre>
          )}
        </div>
      );
    }

    if (message.type === 'success') {
      return (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <div className="text-sm font-medium text-green-900">✓ {message.content}</div>
        </div>
      );
    }

    if (message.type === 'error') {
      return (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <div className="text-sm font-medium text-red-900">✗ {message.content}</div>
        </div>
      );
    }

    return null;
  };

  // Render initial view (before any prompts)
  const renderInitialView = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Agent</h2>

      {/* Input Area with Edit Controls */}
      <div className="relative rounded-lg border border-gray-300" style={{ height: '200px' }}>
        {/* Edit Controls */}
        <div ref={controlsRef} className="flex items-center gap-1 border-b border-gray-200 px-2 py-2">
          {isWide && <span className="text-xs font-medium text-gray-700">Edit:</span>}
          <button
            onClick={() => setInitialEditPrompt(!initialEditPrompt)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              initialEditPrompt
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isNarrow ? 'P' : 'Prompt'}
          </button>
          <button
            onClick={() => setInitialEditData(!initialEditData)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              initialEditData
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isNarrow ? 'D' : 'Data'}
          </button>
          <button
            onClick={() => setInitialEditUICode(!initialEditUICode)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              initialEditUICode
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isNarrow ? 'UI' : 'UICode'}
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={initialInput}
          onChange={(e) => setInitialInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleInitialSubmit();
            }
          }}
          placeholder="Describe what you want to create or modify..."
          className="h-full w-full resize-none border-0 px-3 py-2 text-sm focus:outline-none"
          style={{ height: 'calc(100% - 70px)' }}
        />

        {/* Conversation Selector - Bottom Left */}
        <div ref={convoDropdownRef} className="absolute bottom-2 left-2 z-10">
          <button
            onClick={() => setShowConvoDropdown(!showConvoDropdown)}
            className="flex items-center gap-0.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>
              {selectedConvoId 
                ? conversations.find(c => c.id === selectedConvoId)?.convo_title.slice(0, 20) + 
                  (conversations.find(c => c.id === selectedConvoId)?.convo_title.length! > 20 ? '...' : '')
                : 'Select conversation'
              }
            </span>
            <TbChevronDown className="h-3 w-3" />
          </button>

          {showConvoDropdown && (
            <div className="absolute bottom-full mb-1 left-0 min-w-[200px] max-h-[200px] overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
              {conversations.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No conversations</div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => {
                      setSelectedConvoId(convo.id);
                      setShowConvoDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 transition-colors ${
                      selectedConvoId === convo.id ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    {convo.convo_title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handleInitialSubmit}
          disabled={isRunning || !initialInput.trim() || !selectedConvoId}
          className="absolute bottom-2 right-2 rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run agent"
        >
          {isRunning ? (
            <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
        </button>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`rounded-lg px-3 py-2 text-sm ${
          statusMessage.startsWith('✓') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : statusMessage.startsWith('✗')
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Examples */}
      <div className="flex flex-1 flex-col gap-2 justify-center">
        <h3 className="text-center text-sm font-semibold text-gray-900">Examples</h3>
        {EXAMPLES.map((example) => (
          <button
            key={example.title}
            onClick={() => handleExampleClick(example)}
            disabled={isRunning}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {example.title}
          </button>
        ))}
      </div>
    </>
  );

  // Render chat view (after first prompt)
  const renderChatView = () => {
    if (!sessionContext) return null;

    return (
      <div className="flex h-full flex-col">
        {/* Scrollable Chat History - Chronological append-only log */}
        <div ref={chatMessagesContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 py-2">
          {conversationRounds.map((round, index) => {
            const isLatestRound = index === conversationRounds.length - 1;
            
            return (
              <div key={round.id} className="flex flex-col gap-2">
                {/* User Prompt */}
                <div className="rounded-lg border border-gray-300 bg-white">
                  <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${round.editModes.editPrompt ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      Prompt
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${round.editModes.editData ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      Data
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${round.editModes.editUICode ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      UICode
                    </span>
                    <span className="text-gray-600 text-xs mx-1">|</span>
                    <span className="text-gray-700 text-xs">{sessionContext.conversationTitle}</span>
                  </div>
                  <div className="px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
                    {round.userPrompt}
                  </div>
                </div>

                {/* Agent Response */}
                <div className="ml-4 flex flex-col gap-2">
                  {round.messages.length > 0 ? (
                    round.messages.map((message) => (
                      <MessageDisplay key={message.id} message={message} />
                    ))
                  ) : isLatestRound && isRunning ? (
                    <div className="text-sm italic animate-pulse bg-gradient-to-r from-gray-500 via-gray-600 to-gray-500 bg-clip-text text-transparent">
                      Planning next moves...
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fixed Input Bar at Bottom */}
        <div className="pt-2">
          <div className="rounded-lg border border-gray-300 bg-white flex flex-col">
            {/* Edit toggles - inline */}
            <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5">
              <span className="text-xs font-medium text-gray-700">Edit:</span>
              <button
                onClick={() => setChatEditPrompt(!chatEditPrompt)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  chatEditPrompt
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Prompt
              </button>
              <button
                onClick={() => setChatEditData(!chatEditData)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  chatEditData
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Data
              </button>
              <button
                onClick={() => setChatEditUICode(!chatEditUICode)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  chatEditUICode
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                UICode
              </button>
            </div>

            {/* Input */}
            <div className="px-2">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder="Continue the conversation..."
                className="w-full resize-none border-0 text-sm focus:outline-none"
                rows={1}
                style={{
                  minHeight: `${CHAT_INPUT_MIN_HEIGHT}px`,
                  maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`
                }}
              />
            </div>

            {/* Conversation Selector & Send */}
            <div className="flex items-center justify-between px-3 mb-1 rounded-b-lg">
              <span
                className="text-xs text-gray-600 truncate max-w-[70%]"
                title={sessionContext.conversationTitle}
              >
                {sessionContext.conversationTitle}
              </span>
              <button
                onClick={handleChatSubmit}
                disabled={isRunning || !chatInput.trim()}
                className="rounded-lg bg-gray-900 p-1.5 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                {isRunning ? (
                  <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-white px-4 py-4">
      {sessionContext ? renderChatView() : (
        <div className="flex h-full flex-col gap-3">
          {renderInitialView()}
        </div>
      )}
    </div>
  );
}
