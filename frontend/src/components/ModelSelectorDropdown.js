import React, { useState, useEffect, useRef } from 'react';
import { bedrockService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faExclamationCircle, 
  faCheckCircle,
  faChevronDown,
  faRobot,
  faDollarSign,
  faGlobe
} from '@fortawesome/free-solid-svg-icons';
import './ModelSelectorDropdown.css';

const ModelSelectorDropdown = ({ selectedModel, onModelSelect, disabled = false }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadModelsAndHealth();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadModelsAndHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const health = await bedrockService.getHealth();
      setBedrockHealth(health);
      
      if (health.rag_enabled) {
        const modelsData = await bedrockService.getModels();
        const allModels = modelsData.models || [];
        
        // 텍스트 지원 모델만 필터링 (임베딩 모델 제외)
        const textModels = allModels.filter(model => {
          const modelId = model.model_id.toLowerCase();
          const isEmbeddingModel = modelId.includes('embed') || 
                                  modelId.includes('embedding') ||
                                  (model.output_modalities && 
                                   model.output_modalities.includes('EMBEDDINGS') && 
                                   !model.output_modalities.includes('TEXT'));
          return !isEmbeddingModel;
        });
        
        setModels(textModels);
        
        // 현재 적용된 모델이 있고 선택된 모델이 없으면 자동 선택
        if (textModels.length > 0 && !selectedModel) {
          // 기본 모델 우선순위: Claude 3.5 Sonnet -> Claude 3 Sonnet -> Claude 3 Haiku
          const defaultModel = textModels.find(m => 
            m.model_id.includes('claude-3-5-sonnet') ||
            m.model_id.includes('claude-3-sonnet') ||
            m.model_id.includes('claude-3-haiku')
          ) || textModels[0];
          
          if (defaultModel) {
            onModelSelect(defaultModel);
          }
        }
      } else {
        setModels([]);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      setError('모델 정보를 불러올 수 없습니다.');
      setModels([]);
      setBedrockHealth({ status: 'unavailable', rag_enabled: false });
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (model) => {
    if (!disabled) {
      onModelSelect(model);
      setIsOpen(false);
    }
  };

  const toggleDropdown = () => {
    if (!disabled && models.length > 0) {
      setIsOpen(!isOpen);
    }
  };

  const getStatusIcon = () => {
    if (!bedrockHealth) return null;
    
    switch (bedrockHealth.status) {
      case 'healthy':
        return <FontAwesomeIcon icon={faCheckCircle} className="status-icon status-healthy" />;
      case 'degraded':
        return <FontAwesomeIcon icon={faExclamationCircle} className="status-icon status-warning" />;
      default:
        return <FontAwesomeIcon icon={faExclamationCircle} className="status-icon status-error" />;
    }
  };

  const getStatusText = () => {
    if (!bedrockHealth) return '상태 확인 중...';
    
    switch (bedrockHealth.status) {
      case 'healthy':
        return '정상 작동';
      case 'degraded':
        return '제한적 사용';
      case 'unavailable':
        return 'Mock 모드';
      default:
        return '연결 실패';
    }
  };

  const formatModelName = (modelId) => {
    if (modelId.includes('claude-3-5-sonnet')) {
      return 'Claude 3.5 Sonnet';
    } else if (modelId.includes('claude-3-haiku')) {
      return 'Claude 3 Haiku';
    } else if (modelId.includes('claude-3-sonnet')) {
      return 'Claude 3 Sonnet';
    } else if (modelId.includes('claude-3-opus')) {
      return 'Claude 3 Opus';
    } else if (modelId.includes('titan')) {
      return 'Amazon Titan';
    } else if (modelId.includes('llama')) {
      return 'Llama 2';
    } else {
      const parts = modelId.split('.');
      return parts[parts.length - 1].replace(/-/g, ' ');
    }
  };

  const getModelDescription = (model) => {
    if (model.model_id.includes('claude-3-5-sonnet')) {
      return '최신 • 최고 성능';
    } else if (model.model_id.includes('claude-3-sonnet')) {
      return '균형 • 효율적';
    } else if (model.model_id.includes('claude-3-haiku')) {
      return '빠름 • 경제적';
    } else if (model.model_id.includes('claude-3-opus')) {
      return '강력 • 복잡한 작업';
    } else {
      return '고품질 AI';
    }
  };

  const getCostLevel = (model) => {
    if (model.model_id.includes('haiku')) return 1;
    if (model.model_id.includes('sonnet')) return 2;
    if (model.model_id.includes('opus')) return 3;
    return 2;
  };

  const renderCostIndicator = (level) => {
    return (
      <div className="cost-indicator">
        {[...Array(3)].map((_, i) => (
          <FontAwesomeIcon 
            key={i}
            icon={faDollarSign} 
            className={i < level ? 'active' : 'inactive'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="model-selector-dropdown">
        <div className="dropdown-header loading">
          <FontAwesomeIcon icon={faBrain} className="header-icon" />
          <span>모델 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const currentModelName = selectedModel ? formatModelName(selectedModel.model_id) : 'AI 모델 선택';

  return (
    <div className="model-selector-dropdown" ref={dropdownRef}>
      <div className="dropdown-section">
        <div className="model-header">
          <h4>AI 모델</h4>
          <div className={`status-info ${bedrockHealth?.status === 'healthy' ? 'healthy' : 
            bedrockHealth?.status === 'degraded' ? 'warning' : 'error'}`}>
            {getStatusIcon()}
            <span className="status-text">{getStatusText()}</span>
          </div>
        </div>

        <div 
          className={`dropdown-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={toggleDropdown}
        >
          <div className="trigger-content">
            <FontAwesomeIcon icon={faBrain} className="model-icon" />
            <div className="selected-info">
              <span className="selected-name">{currentModelName}</span>
              {selectedModel && (
                <span className="selected-description">
                  {getModelDescription(selectedModel)}
                </span>
              )}
            </div>
          </div>
          {models.length > 0 && (
            <FontAwesomeIcon 
              icon={faChevronDown} 
              className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}
            />
          )}
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadModelsAndHealth} className="retry-button">
              다시 시도
            </button>
          </div>
        )}

        {!bedrockHealth?.rag_enabled && !error && (
          <div className="fallback-message">
            <FontAwesomeIcon icon={faExclamationCircle} />
            <span>Mock 응답 모드로 실행 중</span>
          </div>
        )}

        {isOpen && models.length > 0 && (
          <div className="dropdown-menu">
            {models.map((model) => (
              <div
                key={model.model_id}
                className={`dropdown-item ${selectedModel?.model_id === model.model_id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model)}
              >
                <div className="item-header">
                  <FontAwesomeIcon icon={faRobot} className="item-icon" />
                  <span className="item-name">{formatModelName(model.model_id)}</span>
                  {renderCostIndicator(getCostLevel(model))}
                </div>
                
                <div className="item-details">
                  <span className="item-description">{getModelDescription(model)}</span>
                  <div className="item-meta">
                    <span className="provider">
                      <FontAwesomeIcon icon={faGlobe} />
                      {model.provider || 'Unknown'}
                    </span>
                    {model.is_cross_region && (
                      <span className="cross-region">Cross-Region</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelectorDropdown;