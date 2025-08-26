import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faInfoCircle, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

const EmbeddingConfig = ({ 
  selectedModel, 
  onModelChange, 
  selectedIndexId,
  disabled = false 
}) => {
  // Available AWS Bedrock embedding models
  const embeddingModels = [
    {
      id: 'amazon.titan-embed-text-v1',
      name: 'Titan Embeddings v1',
      provider: 'Amazon',
      dimensions: 1536,
      maxTokens: 8000,
      description: 'General purpose text embeddings',
      cost: '$0.0001 per 1K tokens'
    },
    {
      id: 'amazon.titan-embed-text-v2:0',
      name: 'Titan Embeddings v2',
      provider: 'Amazon',
      dimensions: [256, 512, 1024],
      maxTokens: 8000,
      description: 'Advanced embeddings with variable dimensions',
      cost: '$0.00002 per 1K tokens',
      features: ['Variable dimensions', 'Better multilingual support', 'Normalized outputs']
    },
    {
      id: 'amazon.titan-embed-image-v1',
      name: 'Titan Multimodal Embeddings',
      provider: 'Amazon',
      dimensions: 1024,
      maxTokens: 8000,
      description: 'Text and image embeddings',
      cost: '$0.0008 per image',
      features: ['Text & Image', 'Cross-modal search']
    }
  ];

  const [showDetails, setShowDetails] = useState(false);
  const [selectedModelDetails, setSelectedModelDetails] = useState(null); // 개별 모델 세부정보 표시
  const [selectedDimension, setSelectedDimension] = useState(512);
  const [normalize, setNormalize] = useState(true);
  
  // Load saved configuration if exists
  useEffect(() => {
    if (selectedIndexId) {
      const savedConfig = localStorage.getItem(`embedding_config_${selectedIndexId}`);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        onModelChange(config);
      }
    }
  }, [selectedIndexId]);

  const handleModelSelect = (model) => {
    const config = {
      modelId: model.id,
      modelName: model.name,
      dimensions: Array.isArray(model.dimensions) ? selectedDimension : model.dimensions,
      normalize: normalize,
      provider: model.provider,
      maxTokens: model.maxTokens
    };
    
    onModelChange(config);
    
    // Save configuration
    if (selectedIndexId) {
      localStorage.setItem(`embedding_config_${selectedIndexId}`, JSON.stringify(config));
    }
  };

  const currentModel = embeddingModels.find(m => m.id === selectedModel?.modelId);

  // 개별 모델 세부정보 토글 핸들러
  const toggleModelDetails = (modelId, e) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    setSelectedModelDetails(prev => prev === modelId ? null : modelId);
  };

  return (
    <div className="embedding-config-container">
      <div className="config-header">
        <h3>
          <FontAwesomeIcon icon={faBrain} className="header-icon" />
          임베딩 모델 설정
        </h3>
        <button 
          className="btn-details"
          onClick={() => setShowDetails(!showDetails)}
          title="Show model details"
        >
          <FontAwesomeIcon icon={faInfoCircle} />
        </button>
      </div>

      <div className="model-selector">
        <label className="config-label">모델 선택</label>
        <div className="model-grid">
          {embeddingModels.map(model => (
            <div 
              key={model.id}
              className={`model-card ${selectedModel?.modelId === model.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && handleModelSelect(model)}
            >
              <div className="model-header">
                <span className="model-name">{model.name}</span>
                {selectedModel?.modelId === model.id && (
                  <FontAwesomeIcon icon={faCheck} className="check-icon" />
                )}
              </div>
              <div className="model-info">
                <span className="provider">{model.provider}</span>
                <div 
                  className={`dimensions-info clickable-spec ${selectedModelDetails === model.id ? 'active' : ''}`}
                  onClick={(e) => toggleModelDetails(model.id, e)}
                  title="차원 세부정보 보기"
                >
                  <span className="dimensions-label">차원:</span>
                  <span className="dimensions-value">
                    {Array.isArray(model.dimensions) 
                      ? `${model.dimensions.join('/')}D` 
                      : `${model.dimensions}D`}
                  </span>
                  <FontAwesomeIcon icon={faInfoCircle} className="spec-icon" />
                </div>
              </div>
              
              <div className="model-description">{model.description}</div>
              
              <div 
                className={`cost-info clickable-spec ${selectedModelDetails === model.id ? 'active' : ''}`}
                onClick={(e) => toggleModelDetails(model.id, e)}
                title="비용 세부정보 보기"
              >
                <span className="cost-label">비용:</span>
                <span className="cost-value">{model.cost}</span>
                <FontAwesomeIcon icon={faInfoCircle} className="spec-icon" />
              </div>
              
              {(showDetails || selectedModelDetails === model.id) && (
                <div className="model-details">
                  <div className="detail-section">
                    <h5 className="detail-section-title">차원 정보</h5>
                    <div className="detail-item">
                      <span className="detail-label">사용 가능한 차원:</span>
                      <div className="detail-value">
                        {Array.isArray(model.dimensions) 
                          ? model.dimensions.map(dim => (
                              <span key={dim} className="dimension-badge">{dim}D</span>
                            ))
                          : <span className="dimension-badge">{model.dimensions}D</span>
                        }
                      </div>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">벡터 크기:</span>
                      <span className="detail-value">
                        {Array.isArray(model.dimensions) 
                          ? `${Math.min(...model.dimensions)} ~ ${Math.max(...model.dimensions)} 차원`
                          : `${model.dimensions} 차원 고정`
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h5 className="detail-section-title">비용 세부정보</h5>
                    <div className="detail-item">
                      <span className="detail-label">토큰당 비용:</span>
                      <span className="detail-value cost-highlight">{model.cost}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">최대 토큰:</span>
                      <span className="detail-value">{model.maxTokens.toLocaleString()}</span>
                    </div>
                    {model.id === 'amazon.titan-embed-image-v1' && (
                      <div className="detail-item">
                        <span className="detail-label">이미지 처리:</span>
                        <span className="detail-value">이미지당 $0.0008</span>
                      </div>
                    )}
                  </div>
                  
                  {model.features && (
                    <div className="detail-section">
                      <h5 className="detail-section-title">주요 기능</h5>
                      <div className="features">
                        {model.features.map((feature, idx) => (
                          <span key={idx} className="feature-tag">{feature}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="detail-section">
                    <h5 className="detail-section-title">사용 권장사항</h5>
                    <div className="recommendations">
                      {model.id === 'amazon.titan-embed-text-v1' && (
                        <p className="recommendation-text">
                          • 일반적인 텍스트 임베딩에 적합<br/>
                          • 안정적인 성능과 호환성 보장<br/>
                          • 기존 프로젝트에 권장
                        </p>
                      )}
                      {model.id === 'amazon.titan-embed-text-v2:0' && (
                        <p className="recommendation-text">
                          • 다국어 지원이 향상된 최신 모델<br/>
                          • 가변 차원으로 용량 최적화 가능<br/>
                          • 새로운 프로젝트에 권장
                        </p>
                      )}
                      {model.id === 'amazon.titan-embed-image-v1' && (
                        <p className="recommendation-text">
                          • 텍스트와 이미지 동시 처리<br/>
                          • 멀티모달 검색 시스템 구축<br/>
                          • 시각적 콘텐츠 포함 문서에 권장
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {currentModel && Array.isArray(currentModel.dimensions) && (
        <div className="dimension-selector">
          <label className="config-label">임베딩 차원 선택</label>
          <div className="dimension-options">
            {currentModel.dimensions.map(dim => (
              <button
                key={dim}
                className={`dimension-btn ${selectedDimension === dim ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedDimension(dim);
                  handleModelSelect(currentModel);
                }}
                disabled={disabled}
              >
                {dim}D
                <span className="dim-desc">
                  {dim === 256 && ' (Fast, Low memory)'}
                  {dim === 512 && ' (Balanced)'}
                  {dim === 1024 && ' (High accuracy)'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedModel && (
        <div className="current-config">
          <h4>현재 설정</h4>
          <div className="config-summary">
            <div className="summary-item">
              <span className="summary-label">Model:</span>
              <span className="summary-value">{selectedModel.modelName}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Dimensions:</span>
              <span className="summary-value">{selectedModel.dimensions}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Normalized:</span>
              <span className="summary-value">
                {selectedModel.normalize ? (
                  <FontAwesomeIcon icon={faCheck} className="success-icon" />
                ) : (
                  <FontAwesomeIcon icon={faTimes} className="error-icon" />
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbeddingConfig;