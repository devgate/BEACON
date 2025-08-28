import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faExclamationCircle,
  faSpinner,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

const EmbeddingModelSelector = ({
  embeddingModels,
  selectedModel,
  loadingModels,
  modelsFetchError,
  onModelChange,
  onRetryFetch
}) => {
  const [expandedSpecs, setExpandedSpecs] = useState({});

  const toggleSpecExpansion = (e, modelId, specType) => {
    e.stopPropagation();
    const key = `${modelId}-${specType}`;
    setExpandedSpecs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatModelData = (model) => {
    const formatDimensions = (dims) => {
      if (Array.isArray(dims)) {
        return dims.map(d => `${d.toLocaleString()}D`).join(', ');
      }
      return typeof dims === 'number' ? `${dims.toLocaleString()}D` : dims;
    };

    const formatCost = (cost) => {
      if (!cost) return null;
      if (typeof cost === 'string') return cost;
      if (typeof cost === 'number') return `$${cost.toFixed(4)}/1K tokens`;
      return cost;
    };

    const formatMaxTokens = (tokens) => {
      if (!tokens) return null;
      if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
      if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
      return tokens.toString();
    };

    return {
      ...model,
      formattedDimensions: formatDimensions(model.dimensions),
      formattedCost: formatCost(model.cost),
      formattedMaxTokens: formatMaxTokens(model.maxTokens)
    };
  };

  if (loadingModels) {
    return (
      <div className="model-loading">
        <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
        <span>AWS Bedrock에서 모델을 불러오는 중...</span>
      </div>
    );
  }

  if (modelsFetchError || embeddingModels.length === 0) {
    return (
      <div className="model-error">
        <FontAwesomeIcon icon={faExclamationCircle} />
        <span>{modelsFetchError || 'AWS Bedrock에서 사용 가능한 임베딩 모델이 없습니다'}</span>
        <button onClick={onRetryFetch} className="retry-btn">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="model-selection">
      {embeddingModels.map(model => {
        const formattedModel = formatModelData(model);
        
        return (
          <div 
            key={model.id}
            className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''} ${model.status !== 'ACTIVE' ? 'disabled' : ''}`}
            onClick={() => model.status === 'ACTIVE' && onModelChange(model.id)}
          >
            {model.recommended && (
              <div className="recommended-badge">추천</div>
            )}
            {model.status !== 'ACTIVE' && (
              <div className="status-badge">사용 불가</div>
            )}
            <div className="model-header">
              <h4>{model.name}</h4>
              <span className="provider">{model.provider}</span>
            </div>
            <div className="model-specs">
              <div 
                className="spec-item dimensions clickable"
                onClick={(e) => toggleSpecExpansion(e, model.id, 'dimensions')}
                title="클릭하여 전체 내용 보기"
              >
                <div className="spec-label">차원</div>
                <div className="spec-value">
                  {expandedSpecs[`${model.id}-dimensions`] 
                    ? formattedModel.formattedDimensions 
                    : formattedModel.formattedDimensions.length > 6 
                      ? `${formattedModel.formattedDimensions.substring(0, 6)}...` 
                      : formattedModel.formattedDimensions}
                </div>
              </div>
              {formattedModel.formattedCost && (
                <div 
                  className="spec-item cost clickable"
                  onClick={(e) => toggleSpecExpansion(e, model.id, 'cost')}
                  title="클릭하여 전체 내용 보기"
                >
                  <div className="spec-label">비용</div>
                  <div className="spec-value">
                    {expandedSpecs[`${model.id}-cost`]
                      ? formattedModel.formattedCost
                      : formattedModel.formattedCost.length > 8 
                        ? `${formattedModel.formattedCost.substring(0, 8)}...` 
                        : formattedModel.formattedCost}
                  </div>
                </div>
              )}
              {formattedModel.formattedMaxTokens && (
                <div className="spec-item tokens">
                  <div className="spec-label">최대 토큰</div>
                  <div className="spec-value">{formattedModel.formattedMaxTokens}</div>
                </div>
              )}
            </div>
            
            {expandedSpecs[`${model.id}-dimensions`] && (
              <div className="model-details-panel">
                <div className="model-details">
                  <div className="detail-section">
                    <h5 className="detail-section-title">차원 정보</h5>
                    <div className="detail-item">
                      <span className="detail-label">사용 가능한 차원:</span>
                      <div className="detail-value">
                        {Array.isArray(model.dimensions) 
                          ? model.dimensions.map(dim => (
                              <span key={dim} className="dimension-badge">{dim.toLocaleString()}D</span>
                            ))
                          : <span className="dimension-badge">{model.dimensions?.toLocaleString()}D</span>
                        }
                      </div>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">벡터 크기:</span>
                      <span className="detail-value">
                        {Array.isArray(model.dimensions) 
                          ? `${Math.min(...model.dimensions).toLocaleString()} ~ ${Math.max(...model.dimensions).toLocaleString()} 차원`
                          : `${model.dimensions?.toLocaleString()} 차원 고정`
                        }
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">권장 사용:</span>
                      <span className="detail-value">
                        {Array.isArray(model.dimensions) 
                          ? "256D (빠른 처리), 512D (균형), 1024D (높은 정확도)"
                          : "고정 차원으로 일관된 성능 보장"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {expandedSpecs[`${model.id}-cost`] && (
              <div className="model-details-panel">
                <div className="model-details">
                  <div className="detail-section">
                    <h5 className="detail-section-title">비용 세부정보</h5>
                    <div className="detail-item">
                      <span className="detail-label">토큰당 비용:</span>
                      <span className="detail-value cost-highlight">{formattedModel.formattedCost || model.cost}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">최대 토큰:</span>
                      <span className="detail-value">{model.maxTokens?.toLocaleString()}</span>
                    </div>
                    {model.id === 'amazon.titan-embed-image-v1' && (
                      <div className="detail-item">
                        <span className="detail-label">이미지 처리:</span>
                        <span className="detail-value">이미지당 $0.0008</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span className="detail-label">예상 월 비용:</span>
                      <span className="detail-value">
                        {model.id === 'amazon.titan-embed-text-v2:0' 
                          ? "100만 토큰당 $0.02 (v1 대비 80% 절약)"
                          : model.id === 'amazon.titan-embed-text-v1'
                          ? "100만 토큰당 $0.10"
                          : "사용량에 따라 산정"
                        }
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">비용 효율성:</span>
                      <span className="detail-value">
                        {model.id === 'amazon.titan-embed-text-v2:0' 
                          ? "⭐⭐⭐⭐⭐ 매우 우수"
                          : model.id === 'amazon.titan-embed-text-v1'
                          ? "⭐⭐⭐ 보통"
                          : "⭐⭐⭐⭐ 좋음"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EmbeddingModelSelector;