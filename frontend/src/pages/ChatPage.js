import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ModelSelectorDropdown from '../components/ModelSelectorDropdown';
import './ChatPage.css';
import { chatService, bedrockService, documentService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faFileAlt, faGlobe, faFile, faBars, faTimes, faCheckCircle, faExclamationCircle, faBrain, faBolt } from '@fortawesome/free-solid-svg-icons';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadBedrockHealth();
    loadUploadedFiles();
    loadKnowledgeBases();

    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setIsSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Listen for custom events when RAG Manager updates knowledge list
    const handleKnowledgeListUpdate = () => {
      loadKnowledgeBases();
    };

    window.addEventListener('knowledgeListUpdated', handleKnowledgeListUpdate);

    // Refresh knowledge bases periodically to stay in sync with server
    const refreshInterval = setInterval(() => {
      loadKnowledgeBases();
    }, 30000); // Refresh every 30 seconds

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('knowledgeListUpdated', handleKnowledgeListUpdate);
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      // PDF 파일만 필터링
      const pdfFiles = documents.filter(doc => 
        doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')
      );
      setUploadedFiles(pdfFiles);
    } catch (error) {
      console.error('Failed to load uploaded files:', error);
      // 에러 시 빈 배열 설정
      setUploadedFiles([]);
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      // Always get from API to ensure consistency with server
      const response = await documentService.getKnowledgeBases();
      if (response && response.knowledge_bases) {
        // Convert to the format expected by the dropdown
        const formattedKnowledgeBases = response.knowledge_bases.map(kb => ({
          id: kb.id,
          name: kb.name,
          status: kb.status || 'active',
          document_count: kb.document_count || 0
        }));
        setKnowledgeBases(formattedKnowledgeBases);
      } else {
        console.warn('No knowledge bases returned from API');
        setKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      // Clear the list on error rather than using stale data
      setKnowledgeBases([]);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      content: message,
      type: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Determine if RAG should be used and get the knowledge base ID
      const useRag = selectedSource && selectedSource.startsWith('kb_');
      const knowledgeBaseId = useRag ? selectedSource.replace('kb_', '') : null;
      
      console.log('Chat request preparation:', {
        selectedSource,
        useRag,
        knowledgeBaseId,
        selectedModel: selectedModel?.model_id
      });
      
      const settings = {
        use_rag: useRag,
        knowledge_base_id: knowledgeBaseId,
        temperature: 0.7,
        max_tokens: 2048,
        top_k_documents: 5
      };

      const response = await chatService.sendMessage(
        message, 
        selectedModel?.model_id,
        settings
      );
      
      // Add AI response
      const aiMessage = {
        id: Date.now() + 1,
        content: response.response,
        type: 'ai',
        timestamp: new Date(),
        images: response.images || [],
        referencedDocs: response.referenced_docs || [],
        modelUsed: response.model_used,
        ragEnabled: response.rag_enabled,
        tokensUsed: response.tokens_used,
        costEstimate: response.cost_estimate,
        processingTime: response.processing_time
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        content: '죄송합니다. 오류가 발생했습니다.',
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = (model, isUserAction = true) => {
    setSelectedModel(model);
    
    // Only show the message if the user manually selected the model
    if (isUserAction && messages.length > 0) {
      const systemMessage = {
        id: Date.now(),
        content: `🤖 "${model.name || model.model_id}" 모델이 선택되었습니다.${bedrockHealth?.rag_enabled ? '' : ' (Mock 모드)'}`,
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, systemMessage]);
    }
  };


  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="page-container">
      {/* Skip Link for Accessibility */}
      <a href="#main-chat" className="skip-link">
        Skip to main chat area
      </a>
      
      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <button 
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? "사이드바 열기" : "사이드바 닫기"}
          aria-expanded={!isSidebarCollapsed}
        >
          <FontAwesomeIcon icon={isSidebarCollapsed ? faBars : faTimes} />
        </button>
      )}
      
      <div className="main-container">
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
          
          <div className="sidebar-section" style={{ marginBottom: '20px' }}>
            <ModelSelectorDropdown
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              disabled={isLoading}
              bedrockHealth={bedrockHealth}
            />
          </div>
          
          {/* Enhanced Source Selection with Unified Design */}
          <div className="sidebar-section">
            <div className="dropdown-section">
              <div className="source-header">
                <h4>소스 선택</h4>
                <div className={`source-status-info ${selectedSource && selectedSource.startsWith('kb_') ? 'healthy' : 
                  selectedSource ? 'warning' : 'error'}`}>
                  <FontAwesomeIcon 
                    icon={selectedSource && selectedSource.startsWith('kb_') ? faCheckCircle :
                      selectedSource ? faExclamationCircle : faExclamationCircle} 
                    className="source-status-icon" 
                  />
                  <span className="source-status-text">
                    {selectedSource ? 
                      (selectedSource.startsWith('kb_') ? 'RAG 활성' : '일반 대화') : 
                      '선택 안됨'
                    }
                  </span>
                </div>
              </div>
              
              <div className="source-selector-wrapper">
                <div className="source-trigger">
                  <div className="trigger-content">
                    <FontAwesomeIcon 
                      icon={selectedSource ? 
                        (selectedSource.startsWith('kb_') ? faFileAlt : faGlobe) : 
                        faFile
                      } 
                      className="source-icon" 
                    />
                    <div className="selected-info">
                      <span className="selected-name">
                        {selectedSource ? 
                          (selectedSource.startsWith('kb_') ? 
                            knowledgeBases.find(kb => kb.id === selectedSource.replace('kb_', ''))?.name || '지식 베이스' :
                            '일반 대화 (RAG 미사용)'
                          ) : 
                          '소스를 선택하세요'
                        }
                      </span>
                      <span className="selected-description">
                        {selectedSource ?
                          (selectedSource.startsWith('kb_') ?
                            `${knowledgeBases.find(kb => kb.id === selectedSource.replace('kb_', ''))?.document_count || 0}개 문서` :
                            'RAG 없는 AI 대화'
                          ) :
                          '원하는 소스를 선택하세요'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <select 
                  className="source-select"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  aria-label="지식 소스 선택"
                >
                  <option value="">💬 일반 대화 (RAG 미사용)</option>
                  <optgroup label="📚 지식 베이스">
                    {knowledgeBases.length > 0 ? (
                      knowledgeBases.map(kb => (
                        <option key={kb.id} value={`kb_${kb.id}`}>
                          📖 {kb.name} ({kb.document_count}개 문서)
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>지식 베이스가 없습니다</option>
                    )}
                  </optgroup>
                </select>
              </div>
              
              {/* Knowledge Base Info Card */}
              {selectedSource && selectedSource.startsWith('kb_') && (
                <div className="kb-info-card">
                  {(() => {
                    const kb = knowledgeBases.find(k => k.id === selectedSource.replace('kb_', ''));
                    return kb ? (
                      <>
                        <div className="kb-info-header">
                          <FontAwesomeIcon icon={faFileAlt} />
                          <span>활성 지식 베이스</span>
                        </div>
                        <div className="kb-details">
                          <div className="kb-detail-item">
                            <span className="label">이름:</span>
                            <span className="value">{kb.name}</span>
                          </div>
                          <div className="kb-detail-item">
                            <span className="label">문서:</span>
                            <span className="value">{kb.document_count}개</span>
                          </div>
                          <div className="kb-detail-item">
                            <span className="label">상태:</span>
                            <span className={`value status ${kb.status}`}>{kb.status === 'active' ? '활성' : kb.status}</span>
                          </div>
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>

        </aside>

        <main id="main-chat" className="chat-area" role="main" aria-label="채팅 영역">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-emoji">👋</div>
              <h2 className="welcome-title">AI 어시스턴트에 오신 것을 환영합니다</h2>
              <p className="welcome-text">
                업로드한 문서에 대해 질문하거나 일반적인 대화를 시작해보세요.
              </p>

              <div className="welcome-features">
                <div className="feature-item">
                  <div className="feature-icon">🧠</div>
                  <div className="feature-content">
                    <h4>스마트한 AI</h4>
                    <p>최신 AI 모델로 정확한 답변</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">📄</div>
                  <div className="feature-content">
                    <h4>문서 분석</h4>
                    <p>PDF 문서를 이해하고 답변</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">💬</div>
                  <div className="feature-content">
                    <h4>빠른 응답</h4>
                    <p>실시간으로 빠르게 대화</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="chat-messages">
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <ChatMessage 
                message={{
                  id: 'loading',
                  content: '답변을 생성하고 있습니다...',
                  type: 'ai',
                  timestamp: new Date(),
                  isLoading: true
                }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
        </main>
      </div>
    </div>
  );
};

export default ChatPage;