import React, { useState, useEffect } from 'react';
import { bedrockService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faExclamationCircle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import './ModelSelector.css';

const ModelSelector = ({ selectedModel, onModelSelect, disabled = false }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModelsAndHealth();
  }, []);

  const loadModelsAndHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load Bedrock health status
      const health = await bedrockService.getHealth();
      setBedrockHealth(health);
      
      // Load available models if Bedrock is available
      if (health.rag_enabled) {
        const modelsData = await bedrockService.getModels();
        setModels(modelsData.models || []);
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
        return 'Bedrock 사용 가능';
      case 'degraded':
        return 'Bedrock 제한적 사용';
      case 'unavailable':
        return 'Bedrock 사용 불가 (Mock 모드)';
      default:
        return 'Bedrock 연결 실패';
    }
  };

  const formatModelName = (modelId) => {
    // Format model names for better display
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
      // Extract model name from ID
      const parts = modelId.split('.');
      return parts[parts.length - 1].replace(/-/g, ' ');
    }
  };

  const getModelDescription = (model) => {
    if (model.name && model.name !== model.model_id) {
      return model.name;
    }
    
    // Provide descriptions for common models
    if (model.model_id.includes('claude-3-5-sonnet')) {
      return '최신 Claude 모델, 뛰어난 성능과 추론 능력';
    } else if (model.model_id.includes('claude-3-sonnet')) {
      return '균형 잡힌 성능과 비용';
    } else if (model.model_id.includes('claude-3-haiku')) {
      return '빠른 응답과 경제적 비용';
    } else if (model.model_id.includes('claude-3-opus')) {
      return '최고 성능, 복잡한 작업에 최적';
    } else {
      return model.description || '고품질 AI 모델';
    }
  };

  const getCostInfo = (model) => {
    if (model.pricing && model.pricing.input_tokens_per_1k) {
      const inputCost = model.pricing.input_tokens_per_1k;
      const outputCost = model.pricing.output_tokens_per_1k;
      return `입력: $${inputCost}/1K, 출력: $${outputCost}/1K`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="model-selector">
        <div className="selector-header">
          <FontAwesomeIcon icon={faBrain} />
          <span>AI 모델</span>
        </div>
        <div className="model-loading">모델 정보를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div className="selector-header">
        <FontAwesomeIcon icon={faBrain} />
        <span>AI 모델</span>
        {getStatusIcon()}
      </div>
      
      <div className="bedrock-status">
        {getStatusText()}
      </div>

      {error && (
        <div className="model-error">
          {error}
          <button onClick={loadModelsAndHealth} className="retry-btn">
            다시 시도
          </button>
        </div>
      )}

      {!bedrockHealth?.rag_enabled && !error && (
        <div className="model-fallback">
          <p>Bedrock이 사용 불가능합니다.</p>
          <p>Mock 응답 모드로 실행됩니다.</p>
        </div>
      )}

      {models.length > 0 && (
        <div className="model-list">
          {models.map((model) => (
            <div
              key={model.model_id}
              className={`model-item ${selectedModel?.model_id === model.model_id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              <div className="model-info">
                <div className="model-name">
                  {formatModelName(model.model_id)}
                  {model.is_cross_region && (
                    <span className="cross-region-badge">Cross-Region</span>
                  )}
                </div>
                <div className="model-description">
                  {getModelDescription(model)}
                </div>
                {getCostInfo(model) && (
                  <div className="model-cost">
                    {getCostInfo(model)}
                  </div>
                )}
                <div className="model-provider">
                  {model.provider || 'Unknown'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;