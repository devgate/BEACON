import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCut,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

const ChunkingStrategyConfig = ({
  chunkingStrategies,
  selectedStrategy,
  chunkSize,
  chunkOverlap,
  onStrategyChange,
  onChunkSizeChange,
  onChunkOverlapChange,
  selectedDocument,
  loadingPreview,
  setNotification
}) => {
  // Debug component props
  console.log('ChunkingStrategyConfig render:', {
    chunkSize,
    chunkOverlap,
    strategyId: selectedStrategy?.id,
    strategyName: selectedStrategy?.name
  });
  const handleQuickStrategyTest = (strategy) => {
    onStrategyChange(strategy.id);
    setNotification({
      message: `Testing with ${strategy.name}`,
      type: 'info'
    });
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <h3>
          <FontAwesomeIcon icon={faCut} /> 청킹 전략
        </h3>
        <p className="section-description">
          문서를 작은 단위로 분할하는 방법을 설정합니다. 검색 정확도와 성능에 영향을 미칩니다.
        </p>
      </div>

      <div className="strategy-selection">
        <select
          value={selectedStrategy?.id || ''}
          onChange={(e) => onStrategyChange(e.target.value)}
          className="strategy-select"
        >
          <option value="">전략 선택...</option>
          {chunkingStrategies.map(strategy => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
      </div>

      {selectedStrategy && (
        <>
          <div className="strategy-info">
            <p className="strategy-description">{selectedStrategy.description}</p>
            <div className="strategy-features">
              {selectedStrategy.features.map((feature, idx) => (
                <span key={idx} className="feature-tag">{feature}</span>
              ))}
            </div>
          </div>

          <div className="chunking-params">
            <div className="param-group">
              <label>
                청크 크기 (토큰)
                <FontAwesomeIcon 
                  icon={faInfoCircle} 
                  className="info-icon"
                  title="각 청크의 최대 토큰 수"
                />
              </label>
              <div className="param-input-group">
                <input
                  type="range"
                  min={selectedStrategy.sizeRange.min}
                  max={selectedStrategy.sizeRange.max}
                  value={chunkSize}
                  onChange={(e) => onChunkSizeChange(e.target.value)}
                  onInput={(e) => onChunkSizeChange(e.target.value)}
                  className="param-slider"
                />
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => onChunkSizeChange(e.target.value)}
                  className="param-number"
                  min={selectedStrategy.sizeRange.min}
                  max={selectedStrategy.sizeRange.max}
                />
              </div>
              <div className="param-hint">
                범위: {selectedStrategy.sizeRange.min} - {selectedStrategy.sizeRange.max}
              </div>
            </div>

            <div className="param-group">
              <label>
                오버랩 크기 (토큰)
                <FontAwesomeIcon 
                  icon={faInfoCircle} 
                  className="info-icon"
                  title="인접 청크 간 중첩되는 토큰 수"
                />
              </label>
              <div className="param-input-group">
                <input
                  type="range"
                  min={0}
                  max={Math.floor(chunkSize * 0.5)}
                  value={chunkOverlap}
                  onChange={(e) => onChunkOverlapChange(e.target.value)}
                  onInput={(e) => onChunkOverlapChange(e.target.value)}
                  className="param-slider"
                />
                <input
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => onChunkOverlapChange(e.target.value)}
                  className="param-number"
                  min={0}
                  max={Math.floor(chunkSize * 0.5)}
                />
              </div>
              <div className="param-hint">
                최대: {Math.floor(chunkSize * 0.5)} (청크 크기의 50%)
              </div>
            </div>
          </div>

          {selectedDocument && !loadingPreview && (
            <div className="strategy-quick-test">
              <div className="strategy-test-label">Quick Strategy Test:</div>
              <div className="strategy-test-buttons">
                {chunkingStrategies.map(strategy => (
                  <button
                    key={strategy.id}
                    onClick={() => handleQuickStrategyTest(strategy)}
                    className={`strategy-test-btn ${
                      selectedStrategy?.id === strategy.id ? 'active' : ''
                    }`}
                  >
                    {strategy.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChunkingStrategyConfig;