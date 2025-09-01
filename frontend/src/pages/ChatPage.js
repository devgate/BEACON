import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ModelSelectorDropdown from '../components/ModelSelectorDropdown';
import './ChatPage.css';
import { chatService, bedrockService, documentService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faFileAlt, faGlobe, faFile } from '@fortawesome/free-solid-svg-icons';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadBedrockHealth();
    loadUploadedFiles();
    loadKnowledgeBases();

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

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    
    const systemMessage = {
      id: Date.now(),
      content: `🤖 "${model.name || model.model_id}" 모델이 선택되었습니다.${bedrockHealth?.rag_enabled ? '' : ' (Mock 모드)'}`,
      type: 'ai',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  return (
    <div className="page-container">
      <div className="main-container">
        <aside className="sidebar">
          
          <div className="sidebar-section" style={{ marginBottom: '20px' }}>
            <ModelSelectorDropdown
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              disabled={isLoading}
              bedrockHealth={bedrockHealth}
            />
          </div>
          
          {/* 소스 선택 드롭다운 */}
          
          <div className="source-section">
            <div className="source-header">
              <h4>Source</h4>
              <div className="source-status">
                <FontAwesomeIcon icon={faFileAlt} className="status-icon" />
                <span className="status-text">
                  {selectedSource ? (selectedSource.startsWith('kb_') ? 'ChromaDB RAG' : '일반') : '선택 가능'}
                </span>
              </div>
            </div>
            <div className="source-dropdown-wrapper">
              <div className="source-trigger">
                <div className="trigger-content">
                  <FontAwesomeIcon icon={faFileAlt} className="source-icon" />
                  <div className="selected-info">
                    <span className="selected-name">
                      {selectedSource ? 
                        (selectedSource.startsWith('kb_') ? 
                          knowledgeBases.find(kb => kb.id === selectedSource.replace('kb_', ''))?.name || '문서' :
                          selectedSource.startsWith('doc_') ? 
                            uploadedFiles.find(f => f.id === selectedSource.replace('doc_', ''))?.file_name || '문서' :
                            '웹 검색'
                        ) : 
                        '소스 선택'
                      }
                    </span>
                    {selectedSource && (
                      <span className="selected-description">
                        {selectedSource.startsWith('kb_') ? '문서' : 
                         selectedSource.startsWith('doc_') ? 'PDF 문서' : '온라인 검색'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <select 
                className="source-select"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                <option value="">일반 대화 (RAG 사용 안함)</option>
                <optgroup label="📚 지식 베이스 (ChromaDB RAG)">
                  {knowledgeBases.length > 0 ? (
                    knowledgeBases.map(kb => (
                      <option key={kb.id} value={`kb_${kb.id}`}>
                        🔍 {kb.name} ({kb.document_count}개 문서)
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>지식 베이스가 없습니다</option>
                  )}
                </optgroup>
              </select>
            </div>
          </div>

        </aside>

        <main className="chat-area">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <h1>안녕하세요! AI 어시스턴트입니다</h1>
              <div className="welcome-subtitle">
                <FontAwesomeIcon icon={faComments} style={{ color: '#00d4ff' }} />
                <span>무엇이든 물어보세요. 도와드리겠습니다.</span>
              </div>
              <div className="welcome-features" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginTop: '32px'
              }}>
                <div className="feature-card" style={{
                  padding: '16px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px'
                }}>
                  <strong style={{ color: '#00d4ff' }}>🚀 빠른 응답</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    최신 AI 모델로 즉각적인 답변
                  </p>
                </div>
                <div className="feature-card" style={{
                  padding: '16px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px'
                }}>
                  <strong style={{ color: '#00d4ff' }}>🎯 정확한 정보</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    신뢰할 수 있는 고품질 응답
                  </p>
                </div>
                <div className="feature-card" style={{
                  padding: '16px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '12px'
                }}>
                  <strong style={{ color: '#00d4ff' }}>💡 다양한 주제</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    코딩부터 일상 대화까지
                  </p>
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