import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import ArenaResponse from '../components/ArenaResponse';
import ArenaVoting from '../components/ArenaVoting';
import './ArenaPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faRobot
} from '@fortawesome/free-solid-svg-icons';

// API services
import { arenaService, bedrockService } from '../services/api';

const ArenaPage = () => {
  // State management
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentComparison, setCurrentComparison] = useState(null);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [inputError, setInputError] = useState('');
  const [availableModels, setAvailableModels] = useState([]);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Function to determine model characteristics based on model info
  const getModelCharacteristics = (model) => {
    const name = model.name.toLowerCase();
    const modelId = model.model_id.toLowerCase();
    
    // Determine speed based on model type
    let speed = 'medium';
    if (name.includes('haiku') || name.includes('micro')) {
      speed = 'fast';
    } else if (name.includes('opus') || name.includes('sonnet 4')) {
      speed = 'slow';
    }
    
    // Determine cost based on model pricing
    let cost = 'medium';
    if (model.cost_per_1k_input_tokens <= 0.0003) {
      cost = 'low';
    } else if (model.cost_per_1k_input_tokens >= 0.003) {
      cost = 'high';
    }
    
    // Generate Korean description
    let description = '고성능 AI 모델';
    if (name.includes('haiku') || name.includes('micro')) {
      description = '빠른 응답 속도';
    } else if (name.includes('lite')) {
      description = '경량화된 모델';
    } else if (name.includes('pro')) {
      description = '전문가용 모델';
    } else if (name.includes('sonnet 4') || name.includes('3.7')) {
      description = '최신 고급 모델';
    } else if (name.includes('opus')) {
      description = '최고 품질';
    } else if (name.includes('sonnet')) {
      description = '균형잡힌 성능';
    }
    
    return { speed, cost, description };
  };

  // Load available models from backend
  const loadAvailableModels = async () => {
    try {
      const response = await bedrockService.getModels();
      
      // Transform backend models to frontend format
      const transformedModels = response.models
        .filter(model => model.status === 'ACTIVE') // Only active models
        .map(model => {
          const characteristics = getModelCharacteristics(model);
          return {
            model_id: model.model_id,
            name: model.name,
            description: characteristics.description,
            speed: characteristics.speed,
            cost: characteristics.cost,
            provider: model.provider,
            max_tokens: model.max_tokens,
            cost_per_1k_input_tokens: model.cost_per_1k_input_tokens,
            cost_per_1k_output_tokens: model.cost_per_1k_output_tokens
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
      
      setAvailableModels(transformedModels);
      console.log(`Loaded ${transformedModels.length} available models:`, transformedModels.map(m => m.name));
    } catch (error) {
      console.error('Failed to load available models:', error);
      // Fallback to a basic model list if API fails
      setAvailableModels([
        {
          model_id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          name: 'Claude 3.5 Sonnet',
          description: '최신 고성능',
          speed: 'medium',
          cost: 'high'
        }
      ]);
    }
  };

  useEffect(() => {
    loadBedrockHealth();
    loadAvailableModels();
    
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentComparison]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadBedrockHealth = async () => {
    try {
      const health = await bedrockService.getHealth();
      setBedrockHealth(health);
    } catch (error) {
      console.error('Failed to load Bedrock health:', error);
      setBedrockHealth({ status: 'unavailable' });
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) {
      setInputError('메시지를 입력해주세요');
      return;
    }

    if (!leftModel || !rightModel) {
      setInputError('두 개의 모델을 모두 선택해주세요');
      return;
    }

    if (leftModel.model_id === rightModel.model_id) {
      setInputError('서로 다른 모델을 선택해주세요');
      return;
    }

    setInputError('');
    setIsLoading(true);

    const messageToSend = currentMessage;
    setCurrentMessage('');

    try {
      const startTime = Date.now();
      
      // Send message to both models simultaneously
      const response = await arenaService.sendMessage({
        message: messageToSend,
        leftModel: leftModel.model_id,
        rightModel: rightModel.model_id,
        settings: {
          temperature: 0.7,
          max_tokens: 2048
        }
      });

      const endTime = Date.now();

      setCurrentComparison({
        id: Date.now(),
        message: messageToSend,
        leftModel,
        rightModel,
        leftResponse: response.leftResponse,
        rightResponse: response.rightResponse,
        timestamp: new Date(),
        totalTime: endTime - startTime,
        voted: false
      });

    } catch (error) {
      console.error('Failed to get arena responses:', error);
      
      // Show error message
      setCurrentComparison({
        id: Date.now(),
        message: messageToSend,
        leftModel,
        rightModel,
        leftResponse: {
          content: '죄송합니다. 응답을 생성하는데 오류가 발생했습니다.',
          error: true,
          processing_time: 0,
          tokens_used: 0,
          cost_estimate: 0
        },
        rightResponse: {
          content: '죄송합니다. 응답을 생성하는데 오류가 발생했습니다.',
          error: true,
          processing_time: 0,
          tokens_used: 0,
          cost_estimate: 0
        },
        timestamp: new Date(),
        totalTime: 0,
        voted: false,
        error: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (winner) => {
    if (!currentComparison || currentComparison.voted) return;

    try {
      await arenaService.vote({
        comparisonId: currentComparison.id,
        winner: winner, // 'left', 'right', 'tie'
        message: currentComparison.message,
        leftModel: currentComparison.leftModel.model_id,
        rightModel: currentComparison.rightModel.model_id
      });

      // Update current comparison as voted
      setCurrentComparison(prev => ({
        ...prev,
        voted: true,
        voteChoice: winner
      }));

    } catch (error) {
      console.error('Failed to record vote:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isReadyToSend = leftModel && rightModel && leftModel.model_id !== rightModel.model_id && currentMessage.trim();

  // Model Selection Component
  const ModelSelector = ({ title, selectedModel, onSelectModel, position }) => {
    // Filter models based on what's selected on the opposite side
    const getAvailableModels = () => {
      if (position === 'left') {
        // Left side: exclude right model if selected
        return rightModel 
          ? availableModels.filter(model => model.model_id !== rightModel.model_id)
          : availableModels;
      } else {
        // Right side: exclude left model if selected
        return leftModel 
          ? availableModels.filter(model => model.model_id !== leftModel.model_id)
          : availableModels;
      }
    };

    const filteredModels = getAvailableModels();

    // Handle model selection with conflict resolution
    const handleModelSelect = (e) => {
      const modelId = e.target.value;
      if (!modelId) {
        onSelectModel(null);
        return;
      }

      const model = availableModels.find(m => m.model_id === modelId);
      if (model) {
        if (position === 'left') {
          // If selecting a model that's already selected on the right, clear the right selection
          if (rightModel && model.model_id === rightModel.model_id) {
            setRightModel(null);
          }
          onSelectModel(model);
        } else {
          // If selecting a model that's already selected on the left, clear the left selection
          if (leftModel && model.model_id === leftModel.model_id) {
            setLeftModel(null);
          }
          onSelectModel(model);
        }
      }
    };

    return (
      <div className="model-selector">
        <h3 className="model-selector-title">{title}</h3>
        <select 
          className="model-select"
          value={selectedModel?.model_id || ''}
          onChange={handleModelSelect}
        >
          <option value="">모델을 선택하세요</option>
          {filteredModels.map(model => (
            <option key={model.model_id} value={model.model_id}>
              {model.name} ({model.description})
            </option>
          ))}
        </select>
        
        {/* Show selected model info */}
        {selectedModel && (
          <div className="selected-model-info">
            <div className="model-tags">
              <span className={`tag speed-${selectedModel.speed}`}>{selectedModel.speed}</span>
              <span className={`tag cost-${selectedModel.cost}`}>{selectedModel.cost}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="arena-page">
      {/* Top: Model Selection */}
      <div className={`arena-header ${currentComparison ? 'compact' : ''}`}>
        <div className="model-selection-container">
          <ModelSelector
            title="Left Model"
            selectedModel={leftModel}
            onSelectModel={setLeftModel}
            position="left"
          />
          <div className="vs-divider">
            <span className="vs-text">VS</span>
          </div>
          <ModelSelector
            title="Right Model"
            selectedModel={rightModel}
            onSelectModel={setRightModel}
            position="right"
          />
        </div>

      </div>

      {/* Middle: Chat Results */}
      <div className="arena-content">
        {!currentComparison ? (
          <div className="arena-welcome">
            <div className="welcome-content">
              <h2>AI 모델 경쟁장</h2>
              <p>두 개의 AI 모델을 선택하고 메시지를 보내서 응답을 비교해보세요.</p>
              <div className="welcome-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <span>좌측과 우측 모델을 선택하세요</span>
                </div>
                <div className="step">
                  <span className="step-number">2</span>
                  <span>하단 입력창에 메시지를 입력하세요</span>
                </div>
                <div className="step">
                  <span className="step-number">3</span>
                  <span>응답을 비교하고 투표하세요</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="arena-comparison">
            {/* User Message */}
            <div className="user-message">
              <div className="message-header">
                <FontAwesomeIcon icon={faRobot} className="user-icon" />
                <span>Your Message</span>
              </div>
              <div className="message-content">{currentComparison.message}</div>
            </div>

            {/* Model Responses */}
            <div className="responses-container">
              <ArenaResponse
                model={currentComparison.leftModel}
                response={currentComparison.leftResponse}
                position="left"
                isLoading={isLoading}
              />
              
              <div className="arena-divider">
                <div className="divider-line"></div>
                <div className="divider-vs">
                  <span>VS</span>
                </div>
                <div className="divider-line"></div>
              </div>
              
              <ArenaResponse
                model={currentComparison.rightModel}
                response={currentComparison.rightResponse}
                position="right"
                isLoading={isLoading}
              />
            </div>

            {/* Voting */}
            {!isLoading && currentComparison && !currentComparison.error && (
              <ArenaVoting
                onVote={handleVote}
                voted={currentComparison.voted}
                voteChoice={currentComparison.voteChoice}
                leftModel={currentComparison.leftModel}
                rightModel={currentComparison.rightModel}
              />
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom: Chat Input */}
      <div className="arena-input">
        <div className="input-container">
          {inputError && (
            <div className="input-error">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              {inputError}
            </div>
          )}
          
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => {
                setCurrentMessage(e.target.value);
                if (inputError) setInputError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder={
                !leftModel || !rightModel 
                  ? "먼저 두 개의 모델을 선택해주세요..." 
                  : "메시지를 입력하고 Enter를 누르세요..."
              }
              className="message-input"
              disabled={isLoading || !bedrockHealth || bedrockHealth.status !== 'healthy'}
              rows="3"
            />
            
            <button
              onClick={handleSendMessage}
              disabled={!isReadyToSend || isLoading}
              className="send-button"
              aria-label="메시지 전송"
            >
              {isLoading ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArenaPage;