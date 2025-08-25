# BEACON Frontend - React Application Documentation

## 🎨 Architecture Overview

**BEACON Frontend**: React 18+ application with modern hooks, component-based architecture, and responsive design for RAG document management and AI chat interface.

### Tech Stack
- **React 18.2.0** - Component library with hooks
- **Tailwind CSS** - Utility-first styling
- **FontAwesome** - Icon library
- **Axios** - HTTP client
- **React Router** - Navigation (if needed)

### Key Features
- **Chat Interface** - Real-time AI conversation with RAG support
- **RAG Manager** - Document and knowledge base management
- **Model Selection** - Multiple AI model support with cost tracking
- **File Management** - PDF upload, preview, and organization
- **Responsive Design** - Mobile-first approach

---

## 📁 Frontend Structure

```
frontend/
├── public/
│   ├── index.html              # Main HTML template
│   ├── favicon.ico            # App icon
│   └── manifest.json          # PWA manifest
│
├── src/
│   ├── index.js               # React app entry point
│   ├── App.js                 # Main app component
│   ├── App.css                # Global styles
│   ├── index.css              # Base CSS and Tailwind imports
│   │
│   ├── pages/                 # Main page components
│   │   ├── ChatPage.js        # Chat interface with RAG
│   │   ├── ChatPage.css       # Chat page styles
│   │   ├── RAGManagerPage.js  # Document/KB management
│   │   └── RAGManagerPage.css # RAG manager styles
│   │
│   ├── components/            # Reusable UI components
│   │   ├── Header.js          # App header/navigation
│   │   ├── ChatMessage.js     # Individual chat message
│   │   ├── ChatInput.js       # Message input component
│   │   ├── CategoryList.js    # Document categories
│   │   ├── FileManager.js     # File upload/management
│   │   ├── SettingsPanel.js   # App settings
│   │   ├── UploadModal.js     # File upload modal
│   │   ├── ModelSelector.js   # AI model selection
│   │   ├── ModelSelector.css  # Model selector styles
│   │   ├── ModelSelectorDropdown.js
│   │   ├── ModelSelectorDropdown.css
│   │   │
│   │   └── rag-manager/       # RAG-specific components
│   │       ├── KnowledgeBuilder.js    # KB creation/management
│   │       ├── KnowledgeFinder.js     # KB search interface  
│   │       ├── AIMaster.js            # AI configuration
│   │       ├── FileManager.js         # File management
│   │       ├── DocumentTable.js       # Document list/table
│   │       ├── BulkActionsBar.js      # Bulk operations
│   │       ├── KnowledgeList.js       # KB listing
│   │       ├── UploadModal.js         # Upload interface
│   │       └── KnowledgeBaseModals.js # KB modal dialogs
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useRAGManager.js   # RAG state management
│   │   └── useRAGHandlers.js  # RAG event handlers
│   │
│   └── services/              # API integration
│       └── api.js             # Backend API client
│
├── package.json               # Dependencies and scripts
├── package-lock.json          # Dependency lock file
├── Dockerfile / Dockerfile.dev # Container configurations
├── default.conf.template      # Nginx configuration template
├── docker-entrypoint.sh       # Container startup script
└── build.sh                   # Production build script
```

---

## 🧩 Core Components

### 1. Main App Component (`App.js`)
```javascript
import React, { useState } from 'react';
import './App.css';
import ChatPage from './pages/ChatPage';
import RAGManagerPage from './pages/RAGManagerPage';

const App = () => {
  const [activeTab, setActiveTab] = useState('chat');

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'rag-manager':
        return <RAGManagerPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">BEACON</h1>
              </div>
              
              {/* Tab Navigation */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`${
                    activeTab === 'chat'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('rag-manager')}
                  className={`${
                    activeTab === 'rag-manager'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  RAG Manager
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
```

### 2. Chat Page (`pages/ChatPage.js`)
```javascript
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ModelSelectorDropdown from '../components/ModelSelectorDropdown';
import { chatService, bedrockService, documentService } from '../services/api';

const ChatPage = () => {
  // State management
  const [messages, setMessages] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const messagesEndRef = useRef(null);

  // Component lifecycle
  useEffect(() => {
    loadBedrockHealth();
    loadUploadedFiles();
    loadKnowledgeBases();

    // Listen for RAG Manager updates
    const handleKnowledgeListUpdate = () => {
      loadKnowledgeBases();
    };

    window.addEventListener('knowledgeListUpdated', handleKnowledgeListUpdate);

    // Auto-refresh knowledge bases
    const refreshInterval = setInterval(loadKnowledgeBases, 30000);

    return () => {
      window.removeEventListener('knowledgeListUpdated', handleKnowledgeListUpdate);
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Data loading functions
  const loadBedrockHealth = async () => {
    try {
      const health = await bedrockService.getHealth();
      setBedrockHealth(health);
    } catch (error) {
      console.error('Failed to load Bedrock health:', error);
      setBedrockHealth({ status: 'unavailable', rag_enabled: false });
    }
  };

  const loadUploadedFiles = async () => {
    try {
      const response = await documentService.getDocuments();
      const documents = response.documents || [];
      const pdfFiles = documents.filter(doc => 
        doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')
      );
      setUploadedFiles(pdfFiles);
    } catch (error) {
      console.error('Failed to load uploaded files:', error);
      setUploadedFiles([]);
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      const response = await documentService.getKnowledgeBases();
      if (response && response.knowledge_bases) {
        const formattedKnowledgeBases = response.knowledge_bases.map(kb => ({
          id: kb.id,
          name: kb.name,
          status: kb.status || 'active',
          document_count: kb.document_count || 0
        }));
        setKnowledgeBases(formattedKnowledgeBases);
      } else {
        setKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      setKnowledgeBases([]);
    }
  };

  // Chat functionality
  const handleSendMessage = async (message, useRAG = true) => {
    if (!message.trim()) return;

    const userMessage = {
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Determine category based on selected source
      let categoryId = null;
      if (selectedSource && selectedSource !== 'general') {
        const sourceType = selectedSource.split(':')[0];
        if (sourceType === 'kb') {
          const kbId = selectedSource.split(':')[1];
          categoryId = parseInt(kbId);
        }
      }

      // Prepare chat request
      const chatRequest = {
        message,
        category_id: categoryId,
        model_id: selectedModel?.model_id || 'anthropic.claude-3-haiku-20240307-v1:0',
        settings: {
          temperature: 0.7,
          max_tokens: 2048,
          use_rag: useRAG && bedrockHealth?.rag_enabled,
          top_k_documents: 5
        }
      };

      // Send to backend
      const response = await chatService.sendMessage(chatRequest);

      const aiMessage = {
        type: 'ai',
        content: response.response,
        timestamp: response.timestamp,
        model_used: response.model_used,
        tokens_used: response.tokens_used,
        cost_estimate: response.cost_estimate,
        confidence_score: response.confidence_score,
        processing_time: response.processing_time,
        referenced_docs: response.referenced_docs,
        images: response.images,
        rag_enabled: response.rag_enabled
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        type: 'error',
        content: '죄송합니다. 메시지 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date().toISOString(),
        error: error.message
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">AI Chat</h2>
            
            {/* Status Indicators */}
            <div className="flex items-center space-x-2">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                bedrockHealth?.status === 'healthy' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {bedrockHealth?.status === 'healthy' ? '✓ AI 연결됨' : '✗ AI 연결 안됨'}
              </div>
              
              {bedrockHealth?.rag_enabled && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  ✓ RAG 활성화
                </div>
              )}
            </div>
          </div>

          {/* Model Selector */}
          <ModelSelectorDropdown
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
          />
        </div>

        {/* Source Selection */}
        <div className="mt-3">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">모든 문서 (일반 대화)</option>
            {knowledgeBases.map(kb => (
              <option key={`kb:${kb.id}`} value={`kb:${kb.id}`}>
                📚 {kb.name} ({kb.document_count}개 문서)
              </option>
            ))}
            {uploadedFiles.map(file => (
              <option key={`file:${file.id}`} value={`file:${file.id}`}>
                📄 {file.file_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-2">👋 안녕하세요!</div>
            <p className="text-gray-400">
              업로드한 문서에 대해 질문하거나 일반적인 대화를 시작해보세요.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message}
              isUser={message.type === 'user'}
              isError={message.type === 'error'}
            />
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="bg-white border-t p-4">
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder={
            bedrockHealth?.status === 'healthy'
              ? "메시지를 입력하세요..."
              : "AI 서비스에 연결할 수 없습니다"
          }
        />
      </div>
    </div>
  );
};

export default ChatPage;
```

### 3. RAG Manager Page (`pages/RAGManagerPage.js`)
```javascript
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faFileAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import { useRAGManager } from '../hooks/useRAGManager';
import { useRAGHandlers } from '../hooks/useRAGHandlers';
import KnowledgeBuilder from '../components/rag-manager/KnowledgeBuilder';
import KnowledgeFinder from '../components/rag-manager/KnowledgeFinder';
import AIMaster from '../components/rag-manager/AIMaster';
import FileManager from '../components/rag-manager/FileManager';

const RAGManagerPage = () => {
  // Custom hooks for state and handlers
  const ragManager = useRAGManager();
  const ragHandlers = useRAGHandlers(ragManager);

  // Initialize data and polling
  useEffect(() => {
    ragManager.loadInitialData();
  }, []);

  useEffect(() => {
    if (ragManager.selectedIndexId) {
      ragManager.loadDocumentsByIndex(ragManager.selectedIndexId);
    }
  }, [ragManager.selectedIndexId]);

  // Document status polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (ragManager.documents.some(doc => doc.status === 'Processing')) {
        ragManager.loadAllDocuments();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [ragManager.documents]);

  // Auto-clear notifications
  useEffect(() => {
    if (ragManager.notification) {
      const timer = setTimeout(() => {
        ragManager.setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [ragManager.notification]);

  // Tab content rendering
  const renderDocumentContent = () => {
    switch(ragManager.activeDocTab) {
      case 'knowledge-builder':
        return (
          <KnowledgeBuilder 
            selectedIndex={ragManager.selectedIndex}
            kbSettings={ragManager.kbSettings}
            setKbSettings={ragManager.setKbSettings}
          />
        );

      case 'knowledge-finder':
        return (
          <KnowledgeFinder 
            selectedIndex={ragManager.selectedIndex}
            kfSettings={ragManager.kfSettings}
            setKfSettings={ragManager.setKfSettings}
          />
        );

      case 'ai-master':
        return (
          <AIMaster 
            selectedIndex={ragManager.selectedIndex}
            aiSettings={ragManager.aiSettings}
            setAiSettings={ragManager.setAiSettings}
          />
        );

      default:
        return (
          <FileManager 
            filteredData={ragManager.filteredData}
            selectedDocuments={ragManager.selectedDocuments}
            selectedIndexId={ragManager.selectedIndexId}
            setShowUploadModal={ragManager.setShowUploadModal}
            handleSelectDocument={ragHandlers.handleSelectDocument}
            handleSelectAllDocuments={ragHandlers.handleSelectAllDocuments}
            handleBulkDelete={ragHandlers.handleBulkDelete}
            handleDocumentAction={ragHandlers.handleDocumentAction}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RAG Manager</h1>
              <p className="mt-1 text-sm text-gray-500">
                문서 업로드, 지식 베이스 관리 및 AI 설정을 통합 관리합니다
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {ragManager.documents.length}
                </div>
                <div className="text-xs text-gray-500">전체 문서</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {ragManager.knowledgeBases.length}
                </div>
                <div className="text-xs text-gray-500">지식 베이스</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Knowledge Base Selector */}
          <div className="mb-6">
            <div className="sm:hidden">
              <select
                value={ragManager.selectedIndexId || ''}
                onChange={(e) => ragManager.setSelectedIndexId(e.target.value || null)}
                className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">모든 문서</option>
                {ragManager.knowledgeBases.map(kb => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb.document_count || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:block">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => ragManager.setSelectedIndexId(null)}
                    className={`${
                      !ragManager.selectedIndexId
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    모든 문서 ({ragManager.documents.length})
                  </button>
                  {ragManager.knowledgeBases.map(kb => (
                    <button
                      key={kb.id}
                      onClick={() => ragManager.setSelectedIndexId(kb.id)}
                      className={`${
                        ragManager.selectedIndexId === kb.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      {kb.name} ({kb.document_count || 0})
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => ragManager.setActiveDocTab('file-manager')}
                  className={`${
                    ragManager.activeDocTab === 'file-manager'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } group inline-flex items-center pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <FontAwesomeIcon 
                    icon={faFileAlt} 
                    className="-ml-0.5 mr-2 h-5 w-5"
                  />
                  파일 관리
                </button>

                <button
                  onClick={() => ragManager.setActiveDocTab('knowledge-builder')}
                  className={`${
                    ragManager.activeDocTab === 'knowledge-builder'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } group inline-flex items-center pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <FontAwesomeIcon 
                    icon={faDatabase} 
                    className="-ml-0.5 mr-2 h-5 w-5"
                  />
                  지식 빌더
                </button>

                <button
                  onClick={() => ragManager.setActiveDocTab('knowledge-finder')}
                  className={`${
                    ragManager.activeDocTab === 'knowledge-finder'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } group inline-flex items-center pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <FontAwesomeIcon 
                    icon={faDatabase} 
                    className="-ml-0.5 mr-2 h-5 w-5"
                  />
                  지식 파인더
                </button>

                <button
                  onClick={() => ragManager.setActiveDocTab('ai-master')}
                  className={`${
                    ragManager.activeDocTab === 'ai-master'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } group inline-flex items-center pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <FontAwesomeIcon 
                    icon={faUser} 
                    className="-ml-0.5 mr-2 h-5 w-5"
                  />
                  AI 마스터
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow rounded-lg">
            {renderDocumentContent()}
          </div>

          {/* Notification Toast */}
          {ragManager.notification && (
            <div className={`fixed bottom-4 right-4 max-w-sm w-full ${
              ragManager.notification.type === 'success' ? 'bg-green-500' : 
              ragManager.notification.type === 'error' ? 'bg-red-500' : 
              'bg-blue-500'
            } text-white px-6 py-3 rounded-lg shadow-lg`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium">{ragManager.notification.message}</p>
                </div>
                <button
                  onClick={() => ragManager.setNotification(null)}
                  className="ml-4 text-white hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RAGManagerPage;
```

---

## 🎣 Custom Hooks

### 1. RAG Manager Hook (`hooks/useRAGManager.js`)
```javascript
import { useState, useEffect } from 'react';
import { documentService, chromaService } from '../services/api';

export const useRAGManager = () => {
  // Core state
  const [documents, setDocuments] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedIndexId, setSelectedIndexId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // UI state
  const [activeDocTab, setActiveDocTab] = useState('file-manager');
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Settings state
  const [kbSettings, setKbSettings] = useState({
    name: '',
    description: '',
    chunkSize: 512,
    overlap: 50
  });

  const [kfSettings, setKfSettings] = useState({
    searchQuery: '',
    maxResults: 10,
    threshold: 0.7
  });

  const [aiSettings, setAiSettings] = useState({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: ''
  });

  // Computed state
  const filteredData = selectedIndexId 
    ? documents.filter(doc => doc.knowledge_base_id === selectedIndexId)
    : documents;

  // Data loading functions
  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAllDocuments(),
        loadKnowledgeBases()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      showNotification('데이터 로딩에 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAllDocuments = async () => {
    try {
      const response = await documentService.getDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      showNotification('문서 목록을 불러올 수 없습니다', 'error');
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      const response = await documentService.getKnowledgeBases();
      const kbs = response.knowledge_bases || [];
      setKnowledgeBases(kbs);
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('knowledgeListUpdated'));
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      showNotification('지식 베이스 목록을 불러올 수 없습니다', 'error');
    }
  };

  const loadDocumentsByIndex = async (indexId) => {
    if (!indexId) return;
    
    try {
      const response = await documentService.getDocumentsByKnowledgeBase(indexId);
      // Update documents with knowledge base filter
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          response.documents.find(d => d.id === doc.id) || doc
        )
      );
    } catch (error) {
      console.error('Failed to load documents by index:', error);
      showNotification('지식 베이스 문서를 불러올 수 없습니다', 'error');
    }
  };

  // Update selected index when selectedIndexId changes
  useEffect(() => {
    if (selectedIndexId) {
      const index = knowledgeBases.find(kb => kb.id === selectedIndexId);
      setSelectedIndex(index || null);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndexId, knowledgeBases]);

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  return {
    // Core state
    documents,
    knowledgeBases,
    selectedIndexId,
    selectedIndex,
    loading,
    notification,

    // UI state
    activeDocTab,
    selectedDocuments,
    showUploadModal,

    // Settings state
    kbSettings,
    kfSettings,
    aiSettings,

    // Computed state
    filteredData,

    // State setters
    setDocuments,
    setKnowledgeBases,
    setSelectedIndexId,
    setSelectedIndex,
    setLoading,
    setNotification,
    setActiveDocTab,
    setSelectedDocuments,
    setShowUploadModal,
    setKbSettings,
    setKfSettings,
    setAiSettings,

    // Data loading functions
    loadInitialData,
    loadAllDocuments,
    loadKnowledgeBases,
    loadDocumentsByIndex,

    // Helpers
    showNotification
  };
};
```

### 2. RAG Handlers Hook (`hooks/useRAGHandlers.js`)
```javascript
import { useCallback } from 'react';
import { documentService, chromaService } from '../services/api';

export const useRAGHandlers = (ragManager) => {
  // Document selection handlers
  const handleSelectDocument = useCallback((documentId) => {
    ragManager.setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  }, [ragManager]);

  const handleSelectAllDocuments = useCallback(() => {
    if (ragManager.selectedDocuments.length === ragManager.filteredData.length) {
      ragManager.setSelectedDocuments([]);
    } else {
      ragManager.setSelectedDocuments(ragManager.filteredData.map(doc => doc.id));
    }
  }, [ragManager]);

  // Bulk operations
  const handleBulkDelete = useCallback(async () => {
    if (ragManager.selectedDocuments.length === 0) return;
    
    if (!window.confirm(`선택한 ${ragManager.selectedDocuments.length}개 문서를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      ragManager.setLoading(true);
      
      // Delete documents one by one
      for (const docId of ragManager.selectedDocuments) {
        await documentService.deleteDocument(docId);
      }

      // Refresh data
      await ragManager.loadAllDocuments();
      await ragManager.loadKnowledgeBases();
      
      ragManager.setSelectedDocuments([]);
      ragManager.showNotification(
        `${ragManager.selectedDocuments.length}개 문서가 삭제되었습니다`, 
        'success'
      );

    } catch (error) {
      console.error('Bulk delete failed:', error);
      ragManager.showNotification('문서 삭제 중 오류가 발생했습니다', 'error');
    } finally {
      ragManager.setLoading(false);
    }
  }, [ragManager]);

  // Document operations
  const handleDocumentAction = useCallback(async (action, documentId) => {
    const document = ragManager.documents.find(doc => doc.id === documentId);
    if (!document) return;

    try {
      ragManager.setLoading(true);

      switch (action) {
        case 'delete':
          if (window.confirm(`"${document.title}"을(를) 삭제하시겠습니까?`)) {
            await documentService.deleteDocument(documentId);
            ragManager.showNotification('문서가 삭제되었습니다', 'success');
            await ragManager.loadAllDocuments();
            await ragManager.loadKnowledgeBases();
          }
          break;

        case 'download':
          window.open(`/api/download/${documentId}`, '_blank');
          break;

        case 'reprocess':
          await documentService.reprocessDocument(documentId);
          ragManager.showNotification('문서 재처리가 시작되었습니다', 'info');
          await ragManager.loadAllDocuments();
          break;

        default:
          console.warn('Unknown document action:', action);
      }

    } catch (error) {
      console.error('Document action failed:', error);
      ragManager.showNotification('작업 중 오류가 발생했습니다', 'error');
    } finally {
      ragManager.setLoading(false);
    }
  }, [ragManager]);

  // Knowledge base operations
  const handleCreateKnowledgeBase = useCallback(async (kbData) => {
    try {
      ragManager.setLoading(true);
      
      const response = await documentService.createKnowledgeBase(kbData);
      
      ragManager.showNotification('지식 베이스가 생성되었습니다', 'success');
      await ragManager.loadKnowledgeBases();
      
      return response;
      
    } catch (error) {
      console.error('Knowledge base creation failed:', error);
      ragManager.showNotification('지식 베이스 생성에 실패했습니다', 'error');
      throw error;
    } finally {
      ragManager.setLoading(false);
    }
  }, [ragManager]);

  const handleDeleteKnowledgeBase = useCallback(async (kbId) => {
    const kb = ragManager.knowledgeBases.find(k => k.id === kbId);
    if (!kb) return;

    if (!window.confirm(`"${kb.name}" 지식 베이스를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      ragManager.setLoading(true);
      
      await documentService.deleteKnowledgeBase(kbId);
      
      ragManager.showNotification('지식 베이스가 삭제되었습니다', 'success');
      await ragManager.loadKnowledgeBases();
      await ragManager.loadAllDocuments();
      
      // Reset selection if deleted KB was selected
      if (ragManager.selectedIndexId === kbId) {
        ragManager.setSelectedIndexId(null);
      }
      
    } catch (error) {
      console.error('Knowledge base deletion failed:', error);
      ragManager.showNotification('지식 베이스 삭제에 실패했습니다', 'error');
    } finally {
      ragManager.setLoading(false);
    }
  }, [ragManager]);

  // File upload handler
  const handleFileUpload = useCallback(async (files, kbId = null) => {
    if (!files || files.length === 0) return;

    try {
      ragManager.setLoading(true);
      
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        if (kbId) {
          formData.append('knowledge_base_id', kbId);
        }

        return await documentService.uploadDocument(formData);
      });

      const results = await Promise.all(uploadPromises);
      
      ragManager.showNotification(
        `${results.length}개 파일이 업로드되었습니다`, 
        'success'
      );
      
      await ragManager.loadAllDocuments();
      await ragManager.loadKnowledgeBases();
      
      return results;
      
    } catch (error) {
      console.error('File upload failed:', error);
      ragManager.showNotification('파일 업로드에 실패했습니다', 'error');
      throw error;
    } finally {
      ragManager.setLoading(false);
      ragManager.setShowUploadModal(false);
    }
  }, [ragManager]);

  return {
    handleSelectDocument,
    handleSelectAllDocuments,
    handleBulkDelete,
    handleDocumentAction,
    handleCreateKnowledgeBase,
    handleDeleteKnowledgeBase,
    handleFileUpload
  };
};
```

---

## 🌐 API Service (`services/api.js`)

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 30000;

// Base API client
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return response;
      }
      
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      
      // Network/connectivity errors
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new Error('네트워크 연결을 확인해주세요');
      }
      
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      ...options,
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }
}

const apiClient = new ApiClient();

// Chat service
export const chatService = {
  async sendMessage(messageData) {
    return await apiClient.post('/chat', messageData);
  },

  async getChatHistory() {
    return await apiClient.get('/chat/history');
  },

  async clearChatHistory() {
    return await apiClient.delete('/chat/history');
  }
};

// Document service
export const documentService = {
  async getDocuments() {
    return await apiClient.get('/documents');
  },

  async uploadDocument(formData) {
    return await apiClient.post('/upload', formData);
  },

  async deleteDocument(documentId) {
    return await apiClient.delete(`/documents/${documentId}`);
  },

  async downloadDocument(documentId) {
    const response = await apiClient.get(`/download/${documentId}`);
    return response; // Returns Response object for file download
  },

  async reprocessDocument(documentId) {
    return await apiClient.post(`/documents/${documentId}/reprocess`);
  },

  async getKnowledgeBases() {
    return await apiClient.get('/knowledge-bases');
  },

  async createKnowledgeBase(kbData) {
    return await apiClient.post('/knowledge-bases', kbData);
  },

  async deleteKnowledgeBase(kbId) {
    return await apiClient.delete(`/knowledge-bases/${kbId}`);
  },

  async getDocumentsByKnowledgeBase(kbId) {
    return await apiClient.get(`/knowledge-bases/${kbId}/documents`);
  }
};

// Bedrock service
export const bedrockService = {
  async getHealth() {
    return await apiClient.get('/bedrock/health');
  },

  async getModels() {
    return await apiClient.get('/bedrock/models');
  },

  async testModel(modelId, prompt) {
    return await apiClient.post('/bedrock/test', {
      model_id: modelId,
      prompt: prompt
    });
  }
};

// ChromaDB service
export const chromaService = {
  async getCollections() {
    return await apiClient.get('/chroma/collections');
  },

  async createCollection(collectionData) {
    return await apiClient.post('/chroma/collections', collectionData);
  },

  async deleteCollection(collectionName) {
    return await apiClient.delete(`/chroma/collections/${collectionName}`);
  },

  async queryCollection(collectionName, queryData) {
    return await apiClient.post(`/chroma/collections/${collectionName}/query`, queryData);
  }
};

// Categories service
export const categoriesService = {
  async getCategories() {
    return await apiClient.get('/categories');
  },

  async createCategory(categoryData) {
    return await apiClient.post('/categories', categoryData);
  },

  async updateCategory(categoryId, categoryData) {
    return await apiClient.put(`/categories/${categoryId}`, categoryData);
  },

  async deleteCategory(categoryId) {
    return await apiClient.delete(`/categories/${categoryId}`);
  },

  async getCategoryDocuments(categoryId) {
    return await apiClient.get(`/categories/${categoryId}/documents`);
  }
};
```

---

## 🎨 Styling & Components

### Tailwind Configuration (`tailwind.config.js`)
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

### CSS Variables (`index.css`)
```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Custom CSS Variables */
:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #06b6d4;
  
  --border-radius: 0.5rem;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 300ms ease-in-out;
}

/* Base styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Custom component classes */
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
}

.input-field {
  @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm;
}

.card {
  @apply bg-white shadow-md rounded-lg p-6;
}

.notification-success {
  @apply bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg;
}

.notification-error {
  @apply bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg;
}

.notification-info {
  @apply bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg;
}

/* Animation utilities */
.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}

/* Loading spinner */
.spinner {
  @apply inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

/* Chat message bubbles */
.message-user {
  @apply bg-blue-600 text-white rounded-lg rounded-br-none p-3 max-w-xs ml-auto;
}

.message-ai {
  @apply bg-gray-100 text-gray-900 rounded-lg rounded-bl-none p-3 max-w-xs mr-auto;
}

.message-error {
  @apply bg-red-100 text-red-800 border border-red-200 rounded-lg p-3 max-w-xs mr-auto;
}
```

---

## 🚀 Build & Deployment

### Development Setup
```json
{
  "name": "beacon-frontend",
  "version": "1.4.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "@fortawesome/fontawesome-svg-core": "^6.4.0",
    "@fortawesome/free-solid-svg-icons": "^6.4.0",
    "@fortawesome/react-fontawesome": "^0.2.0",
    "axios": "^1.5.0",
    "tailwindcss": "^3.3.3"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src/**/*.{js,jsx}",
    "lint:fix": "eslint src/**/*.{js,jsx} --fix",
    "format": "prettier --write src/**/*.{js,jsx,css,md}"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^5.16.4",
    "@testing-library/react": "^13.3.0",
    "@testing-library/user-event": "^13.5.0",
    "eslint": "^8.45.0",
    "prettier": "^3.0.0"
  }
}
```

### Docker Configuration
```dockerfile
# Dockerfile.dev (Development)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# Dockerfile (Production)
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY default.conf.template /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Configuration
```bash
# .env.development
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENVIRONMENT=development
GENERATE_SOURCEMAP=true
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true

# .env.production  
REACT_APP_API_URL=https://api.beacon.example.com/api
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
```

---

## 🧪 Testing

### Component Testing
```javascript
// components/__tests__/ChatMessage.test.js
import { render, screen } from '@testing-library/react';
import ChatMessage from '../ChatMessage';

describe('ChatMessage', () => {
  test('renders user message correctly', () => {
    const message = {
      type: 'user',
      content: 'Hello, AI!',
      timestamp: '2025-01-15T10:00:00Z'
    };

    render(<ChatMessage message={message} isUser={true} />);
    
    expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  test('renders AI message with metadata', () => {
    const message = {
      type: 'ai',
      content: 'Hello, human!',
      model_used: 'claude-3-haiku',
      confidence_score: 0.95,
      referenced_docs: [{ title: 'test.pdf', relevance_score: 0.9 }]
    };

    render(<ChatMessage message={message} isUser={false} />);
    
    expect(screen.getByText('Hello, human!')).toBeInTheDocument();
    expect(screen.getByText(/claude-3-haiku/)).toBeInTheDocument();
    expect(screen.getByText(/confidence.*95%/i)).toBeInTheDocument();
  });
});
```

### Integration Testing
```javascript
// pages/__tests__/ChatPage.integration.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatPage from '../ChatPage';
import * as api from '../../services/api';

// Mock API
jest.mock('../../services/api');

describe('ChatPage Integration', () => {
  beforeEach(() => {
    api.bedrockService.getHealth.mockResolvedValue({
      status: 'healthy',
      rag_enabled: true
    });
    
    api.documentService.getDocuments.mockResolvedValue({
      documents: []
    });
    
    api.documentService.getKnowledgeBases.mockResolvedValue({
      knowledge_bases: []
    });
  });

  test('complete chat flow', async () => {
    api.chatService.sendMessage.mockResolvedValue({
      response: 'AI response',
      model_used: 'claude-3-haiku',
      rag_enabled: true,
      confidence_score: 0.9
    });

    render(<ChatPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/AI 연결됨/)).toBeInTheDocument();
    });

    // Type message
    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    fireEvent.change(input, { target: { value: 'Test message' } });

    // Send message
    fireEvent.click(screen.getByText('전송'));

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('AI response')).toBeInTheDocument();
    });

    // Verify API call
    expect(api.chatService.sendMessage).toHaveBeenCalledWith({
      message: 'Test message',
      category_id: null,
      model_id: expect.any(String),
      settings: expect.objectContaining({
        use_rag: true,
        top_k_documents: 5
      })
    });
  });
});
```

### Performance Testing
```javascript
// utils/performance.test.js
import { measurePerformance } from '../performance';

describe('Performance Monitoring', () => {
  test('component render time', () => {
    const startTime = performance.now();
    
    // Render heavy component
    render(<RAGManagerPage />);
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });

  test('API call performance', async () => {
    const result = await measurePerformance(async () => {
      return await api.chatService.sendMessage({ message: 'test' });
    });

    expect(result.duration).toBeLessThan(5000); // 5 second threshold
    expect(result.success).toBe(true);
  });
});
```