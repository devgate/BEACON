import React, { useState, useEffect, useRef } from 'react';
import CategoryList from '../components/CategoryList';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import { chatService, bedrockService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments } from '@fortawesome/free-solid-svg-icons';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCategories();
    loadBedrockHealth();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadCategories = async () => {
    try {
      const data = await chatService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
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
      // Determine RAG settings based on category selection
      // If no category selected, use general conversation mode
      // If category selected, check if it has documents for RAG
      let useRag = false;
      if (selectedCategoryId) {
        // Category is selected, check if there are documents available for RAG
        if (selectedCategoryId === 'all') {
          useRag = categories.some(cat => cat.document_count > 0);
        } else {
          const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
          useRag = selectedCategory && selectedCategory.document_count > 0;
        }
      }
      // If no category selected (selectedCategoryId is null), useRag remains false (general conversation)
      
      const settings = {
        use_rag: useRag,
        temperature: 0.7,
        max_tokens: 2048,
        top_k_documents: 5
      };

      const response = await chatService.sendMessage(
        message, 
        selectedCategoryId, 
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

  const handleCategorySelect = (categoryId) => {
    setSelectedCategoryId(categoryId);
    
    let systemMessage;
    
    if (categoryId === null) {
      // Category deselected - switch to general conversation mode
      systemMessage = {
        id: Date.now(),
        content: `💬 일반 대화 모드로 전환되었습니다. 문서 없이 자유롭게 대화할 수 있습니다.`,
        type: 'ai',
        timestamp: new Date()
      };
    } else {
      // Category selected
      const category = categoryId === 'all' 
        ? { name: '전체', document_count: categories.reduce((sum, cat) => sum + (cat.document_count || 0), 0) }
        : categories.find(cat => cat.id === categoryId);
      
      if (category) {
        const mode = category.document_count > 0 ? 'RAG' : '일반 대화';
        systemMessage = {
          id: Date.now(),
          content: `📁 "${category.name}" 카테고리가 선택되었습니다. (문서 ${category.document_count}개, ${mode} 모드)`,
          type: 'ai',
          timestamp: new Date()
        };
      }
    }
    
    if (systemMessage) {
      setMessages(prev => [...prev, systemMessage]);
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
          <div className="sidebar-section">
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              disabled={isLoading}
            />
          </div>
          
          <div className="sidebar-section">
            <h3>문서 카테고리</h3>
            <CategoryList 
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleCategorySelect}
            />
          </div>
        </aside>

        <main className="chat-area">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <h1>안녕하세요! AI 어시스턴트입니다</h1>
              <div className="welcome-subtitle">
                <FontAwesomeIcon icon={faComments} style={{ color: '#00d4ff' }} />
                <span>
                  {selectedCategoryId 
                    ? "업로드된 문서에 대해 자유롭게 질문해보세요" 
                    : "일반 대화나 문서 기반 질문 모두 가능합니다"
                  }
                </span>
              </div>
              <div className="welcome-modes">
                <div className="mode-info">
                  <strong>💬 일반 대화:</strong> 카테고리를 선택하지 않으면 일반 대화 모드입니다
                </div>
                <div className="mode-info">
                  <strong>📁 문서 기반:</strong> 카테고리를 선택하면 업로드된 문서를 기반으로 답변합니다
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