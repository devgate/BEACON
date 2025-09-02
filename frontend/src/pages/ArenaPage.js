import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import ArenaResponse from '../components/ArenaResponse';
// TODO: 투표 기능 추후 구현
// import ArenaVoting from '../components/ArenaVoting';
import './ArenaPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faRobot,
  faBrain,
  faLightbulb,
  // faVoteYea, // TODO: 투표 기능 추후 구현
  faRocket,
  faStar,
  faPlay
} from '@fortawesome/free-solid-svg-icons';

// API services
import { arenaService, bedrockService } from '../services/api';

const ArenaPage = () => {
  // State management
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leftProgress, setLeftProgress] = useState(0);
  const [rightProgress, setRightProgress] = useState(0);
  const [currentComparison, setCurrentComparison] = useState(null);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [inputError, setInputError] = useState('');
  const [availableModels, setAvailableModels] = useState([]);

  // Refs
  const responsesRef = useRef(null);
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
    scrollToResponses();
  }, [currentComparison]);

  const scrollToResponses = () => {
    if (currentComparison && responsesRef.current) {
      responsesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    setLeftProgress(0);
    setRightProgress(0);

    const messageToSend = currentMessage;
    setCurrentMessage('');

    // Progress simulation for both models
    const leftProgressInterval = setInterval(() => {
      setLeftProgress(prev => {
        if (prev >= 90) return prev; // Stop at 90% until real response
        const increment = Math.random() * 12 + 3; // Random increment 3-15%
        return Math.min(prev + increment, 90); // Cap at 90%
      });
    }, 150 + Math.random() * 100); // Slightly different timing

    const rightProgressInterval = setInterval(() => {
      setRightProgress(prev => {
        if (prev >= 90) return prev; // Stop at 90% until real response
        const increment = Math.random() * 12 + 3; // Random increment 3-15%
        return Math.min(prev + increment, 90); // Cap at 90%
      });
    }, 200 + Math.random() * 100); // Different timing to show variation

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

      // Complete progress
      clearInterval(leftProgressInterval);
      clearInterval(rightProgressInterval);
      setLeftProgress(100);
      setRightProgress(100);

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
      
      // Complete progress on error
      clearInterval(leftProgressInterval);
      clearInterval(rightProgressInterval);
      setLeftProgress(100);
      setRightProgress(100);
      
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
      // Reset progress after a brief delay
      setTimeout(() => {
        setLeftProgress(0);
        setRightProgress(0);
      }, 1000);
    }
  };

  // TODO: 투표 기능 추후 구현
  // const handleVote = async (winner) => {
  //   if (!currentComparison || currentComparison.voted) return;

  //   try {
  //     await arenaService.vote({
  //       comparisonId: currentComparison.id,
  //       winner: winner, // 'left', 'right', 'tie'
  //       message: currentComparison.message,
  //       leftModel: currentComparison.leftModel.model_id,
  //       rightModel: currentComparison.rightModel.model_id
  //     });

  //     // Update current comparison as voted
  //     setCurrentComparison(prev => ({
  //       ...prev,
  //       voted: true,
  //       voteChoice: winner
  //     }));

  //   } catch (error) {
  //     console.error('Failed to record vote:', error);
  //   }
  // };

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
        <div className="selected-model-info">
          {selectedModel && (
            <div className="model-tags">
              <span className={`tag speed-${selectedModel.speed}`}>{selectedModel.speed}</span>
              <span className={`tag cost-${selectedModel.cost}`}>{selectedModel.cost}</span>
            </div>
          )}
        </div>
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
        {isLoading ? (
          <div className="arena-loading">
            <div className="loading-content">
              <div className="loading-spinner-large">
                <FontAwesomeIcon icon={faSpinner} spin />
              </div>
              <h3 className="loading-title">AI 응답 생성 중</h3>
              <p className="loading-description">
                선택한 두 모델이 동시에 응답을 생성하고 있습니다...
              </p>
              <div className="loading-models-progress">
                <div className="loading-model-progress">
                  <div className="model-info">
                    <div className="model-name">{leftModel?.name}</div>
                    <div className="model-status">
                      <FontAwesomeIcon icon={faSpinner} spin size="sm" />
                      <span>{Math.round(leftProgress)}%</span>
                    </div>
                  </div>
                  <div className="progress-bar-model">
                    <div 
                      className="progress-fill left-progress" 
                      style={{ width: `${leftProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="loading-divider">
                  <span>VS</span>
                </div>

                <div className="loading-model-progress">
                  <div className="model-info">
                    <div className="model-name">{rightModel?.name}</div>
                    <div className="model-status">
                      <FontAwesomeIcon icon={faSpinner} spin size="sm" />
                      <span>{Math.round(rightProgress)}%</span>
                    </div>
                  </div>
                  <div className="progress-bar-model">
                    <div 
                      className="progress-fill right-progress" 
                      style={{ width: `${rightProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !currentComparison ? (
          <div className="arena-welcome">
            <div className="welcome-content">
              <div className="welcome-hero">
                <div className="hero-icon">
                  <FontAwesomeIcon icon={faRocket} />
                </div>
                <h1 className="welcome-title">AI 모델 경쟁장</h1>
                <div className="title-accent"></div>
                <p className="welcome-subtitle">
                  두 개의 AI 모델을 선택하고 메시지를 보내서 응답을 비교해보세요.
                </p>
              </div>
              
              {/* <div className="welcome-features">
                <div className="feature-card">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faBrain} />
                  </div>
                  <div className="feature-content">
                    <h3>다양한 AI 모델</h3>
                    <p>Claude, GPT 등 최신 AI 모델들을 한 번에 비교</p>
                  </div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faLightbulb} />
                  </div>
                  <div className="feature-content">
                    <h3>실시간 비교</h3>
                    <p>동일한 질문에 대한 서로 다른 AI의 응답 비교</p>
                  </div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faVoteYea} />
                  </div>
                  <div className="feature-content">
                    <h3>투표 시스템</h3>
                    <p>더 나은 응답을 선택하여 AI 성능 평가 참여</p>
                  </div>
                </div>
              </div> */}
              
              <div className="welcome-steps">
                {/* <h3 className="steps-title">시작하는 방법</h3> */}
                <div className="steps-container">
                  <div className="step">
                    <div className="step-icon">
                      <span className="step-number">1</span>
                      <FontAwesomeIcon icon={faRobot} className="step-bg-icon" />
                    </div>
                    <div className="step-content">
                      <h4>모델 선택</h4>
                      <p>상단에서 좌측과 우측 AI 모델을 선택하세요</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-icon">
                      <span className="step-number">2</span>
                      <FontAwesomeIcon icon={faPlay} className="step-bg-icon" />
                    </div>
                    <div className="step-content">
                      <h4>질문 입력</h4>
                      <p>하단 입력창에 궁금한 것을 입력하고 전송하세요</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-icon">
                      <span className="step-number">3</span>
                      <FontAwesomeIcon icon={faStar} className="step-bg-icon" />
                    </div>
                    <div className="step-content">
                      <h4>응답 비교</h4>
                      <p>두 AI의 응답을 비교하고 차이점을 확인하세요</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="welcome-cta">
                <div className="cta-content">
                  <p className="cta-text">지금 시작해보세요!</p>
                  <div className="cta-indicator">
                    <span className="indicator-text">위에서 모델을 선택하세요</span>
                    <div className="pulse-arrow">↑</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : currentComparison ? (
          <div className="arena-comparison">
            {/* Model Responses */}
            <div className="responses-container" ref={responsesRef}>
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

            {/* TODO: 투표 기능 추후 구현 */}
            {/* {!isLoading && currentComparison && !currentComparison.error && (
              <ArenaVoting
                onVote={handleVote}
                voted={currentComparison.voted}
                voteChoice={currentComparison.voteChoice}
                leftModel={currentComparison.leftModel}
                rightModel={currentComparison.rightModel}
              />
            )} */}
          </div>
        ) : (
          // Empty state when no comparison and not loading
          <div className="arena-welcome">
            <div className="welcome-content">
              <div className="welcome-hero">
                <div className="hero-icon">
                  <FontAwesomeIcon icon={faRocket} />
                </div>
                <h1 className="welcome-title">준비 완료</h1>
                <p className="welcome-subtitle">
                  모델이 선택되었습니다. 하단에서 메시지를 보내주세요.
                </p>
              </div>
            </div>
          </div>
        )}
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