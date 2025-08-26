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
                <span className="dimensions">
                  {Array.isArray(model.dimensions) 
                    ? `${model.dimensions.join('/')}D` 
                    : `${model.dimensions}D`}
                </span>
              </div>
              <div className="model-description">{model.description}</div>
              {showDetails && (
                <div className="model-details">
                  <div className="detail-item">
                    <span className="detail-label">Max Tokens:</span>
                    <span className="detail-value">{model.maxTokens.toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Cost:</span>
                    <span className="detail-value">{model.cost}</span>
                  </div>
                  {model.features && (
                    <div className="features">
                      {model.features.map((feature, idx) => (
                        <span key={idx} className="feature-tag">{feature}</span>
                      ))}
                    </div>
                  )}
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