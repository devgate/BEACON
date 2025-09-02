import React, { useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRobot,
  faClock,
  faCoins,
  faHashtag,
  faSpinner,
  faExclamationTriangle,
  faCrown,
  faChartLine,
  faBolt,
  faMemory,
  faExpand,
  faCompress,
  faCopy,
  faCheck
} from '@fortawesome/free-solid-svg-icons';
import './ArenaResponse.css';

const ArenaResponse = React.memo(({ 
  model, 
  response, 
  isLoading, 
  position, 
  className, 
  ariaLabel 
}) => {
  const side = position; // position을 side로 매핑
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);
  // Memoized formatters for performance
  const formatResponseTime = useCallback((ms) => {
    if (!ms && ms !== 0) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }, []);

  const formatTokens = useCallback((tokens) => {
    if (!tokens && tokens !== 0) return 'N/A';
    return tokens.toLocaleString();
  }, []);

  const formatCost = useCallback((cost) => {
    if (!cost && cost !== 0) return 'N/A';
    return `$${cost.toFixed(6)}`;
  }, []);

  const getModelDisplayName = useCallback((model) => {
    if (!model) return 'Unknown Model';
    return model.name || model.model_id || 'Unknown Model';
  }, []);

  const getModelIcon = useCallback((modelId) => {
    if (!modelId) return faRobot;
    if (modelId.includes('claude')) return faRobot;
    if (modelId.includes('titan')) return faChartLine;
    if (modelId.includes('gpt')) return faBolt;
    return faRobot;
  }, []);

  // Enhanced performance calculations
  const performanceMetrics = useMemo(() => {
    if (!response || response.error) {
      return {
        speedScore: 0,
        efficiencyScore: 0,
        costScore: 0,
        overall: 0
      };
    }

    const speedScore = Math.max(10, Math.min(100, (5000 - (response.processing_time || 0)) / 50));
    const efficiencyScore = Math.max(10, Math.min(100, (3000 - (response.tokens_used || 0)) / 30));
    const costScore = Math.max(10, Math.min(100, (0.1 - (response.cost_estimate || 0)) * 1000));
    const overall = (speedScore + efficiencyScore + costScore) / 3;

    return {
      speedScore: Math.round(speedScore),
      efficiencyScore: Math.round(efficiencyScore),
      costScore: Math.round(costScore),
      overall: Math.round(overall)
    };
  }, [response]);

  // Copy response content to clipboard
  const handleCopyResponse = useCallback(async () => {
    if (!response?.content) return;
    
    try {
      await navigator.clipboard.writeText(response.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy response:', err);
    }
  }, [response?.content]);

  // Toggle expanded view
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Status configuration
  const statusConfig = useMemo(() => {
    if (isLoading) {
      return {
        icon: faSpinner,
        text: '응답 생성중...',
        className: 'status-loading',
        spin: true
      };
    }
    
    if (response?.error) {
      return {
        icon: faExclamationTriangle,
        text: '오류 발생',
        className: 'status-error'
      };
    }
    
    if (response) {
      return {
        icon: faCrown,
        text: '응답 완료',
        className: 'status-ready'
      };
    }
    
    return {
      icon: faMemory,
      text: '대기중',
      className: 'status-waiting'
    };
  }, [isLoading, response]);

  return (
    <article 
      className={`arena-response ${className} ${side}-side ${isExpanded ? 'expanded' : ''}`}
      role="region"
      aria-label={ariaLabel || `${side} 모델 응답`}
    >
      {/* Enhanced Model Header */}
      <header className="response-header">
        <div className="model-info">
          <div className="model-icon-wrapper">
            <FontAwesomeIcon 
              icon={getModelIcon(model?.model_id)} 
              className="model-icon" 
              aria-hidden="true"
            />
            <div className={`model-indicator ${side}-indicator`} aria-hidden="true"></div>
          </div>
          
          <div className="model-details">
            <h3 className="model-name">{getModelDisplayName(model)}</h3>
            <span className="model-id">{model?.model_id || 'No model selected'}</span>
            {performanceMetrics.overall > 0 && (
              <div className="model-score" aria-label={`성능 점수 ${performanceMetrics.overall}점`}>
                성능: {performanceMetrics.overall}/100
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Status & Actions */}
        <div className="response-actions">
          <div className={`response-status ${statusConfig.className}`} aria-live="polite">
            <FontAwesomeIcon 
              icon={statusConfig.icon} 
              spin={statusConfig.spin}
              className="status-icon" 
              aria-hidden="true"
            />
            <span>{statusConfig.text}</span>
          </div>
          
          {response && !isLoading && (
            <div className="action-buttons">
              <button 
                className="action-btn copy-btn"
                onClick={handleCopyResponse}
                aria-label="응답 내용 복사"
                title="응답 내용을 클립보드에 복사"
                disabled={!response.content}
              >
                <FontAwesomeIcon icon={copySuccess ? faCheck : faCopy} />
              </button>
              
              <button 
                className="action-btn expand-btn"
                onClick={toggleExpanded}
                aria-label={isExpanded ? '축소' : '확장'}
                title={isExpanded ? '축소하기' : '확장하기'}
              >
                <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Enhanced Response Content */}
      <main className={`response-content ${isExpanded ? 'expanded' : ''}`}>
        {isLoading ? (
          <div className="loading-placeholder" role="status" aria-label="응답 생성 중">
            <div className="loading-animation">
              <div className="loading-spinner-container">
                <FontAwesomeIcon icon={faSpinner} spin className="loading-spinner" />
                <div className="loading-pulse"></div>
              </div>
              <div className="loading-text">
                <p>AI가 답변을 생성하고 있습니다...</p>
                <div className="loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
                <div className="loading-progress">
                  <div className="progress-bar"></div>
                </div>
              </div>
            </div>
          </div>
        ) : response ? (
          <div className="response-wrapper">
            <div className={`response-text ${response.error ? 'error-response' : ''}`}
                 role="main"
                 aria-label="모델 응답 내용">
              {response.content || '응답을 받지 못했습니다.'}
            </div>
            
            {response.content && !response.error && (
              <div className="response-footer">
                <div className="response-stats">
                  <span className="word-count">
                    단어: {response.content.split(/\s+/).length.toLocaleString()}개
                  </span>
                  <span className="char-count">
                    문자: {response.content.length.toLocaleString()}개
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-response" role="status">
            <div className="empty-icon-wrapper">
              <FontAwesomeIcon icon={faRobot} className="empty-icon" aria-hidden="true" />
              <div className="empty-pulse"></div>
            </div>
            <div className="empty-text">
              <h4>응답 대기 중</h4>
              <p>메시지를 보내면 {side === 'left' ? '왼쪽' : '오른쪽'} 모델의 응답이 여기에 표시됩니다</p>
            </div>
          </div>
        )}
      </main>

      {/* Enhanced Response Metadata */}
      {response && !isLoading && (
        <footer className="response-metadata" aria-label="응답 메타데이터">
          <div className="metadata-grid">
            <div className="metadata-item" role="group" aria-label="응답 시간">
              <FontAwesomeIcon icon={faClock} className="metadata-icon" aria-hidden="true" />
              <div className="metadata-content">
                <span className="metadata-label">응답 시간</span>
                <span className="metadata-value">{formatResponseTime(response.processing_time)}</span>
              </div>
              <div className="metadata-trend" aria-hidden="true">
                {response.processing_time < 2000 ? '⚡' : response.processing_time < 5000 ? '🔵' : '🔴'}
              </div>
            </div>

            <div className="metadata-item" role="group" aria-label="토큰 사용량">
              <FontAwesomeIcon icon={faHashtag} className="metadata-icon" aria-hidden="true" />
              <div className="metadata-content">
                <span className="metadata-label">토큰 사용</span>
                <span className="metadata-value">{formatTokens(response.tokens_used)}</span>
              </div>
              <div className="metadata-trend" aria-hidden="true">
                {response.tokens_used < 1000 ? '🟢' : response.tokens_used < 2000 ? '🟡' : '🟠'}
              </div>
            </div>

            <div className="metadata-item" role="group" aria-label="예상 비용">
              <FontAwesomeIcon icon={faCoins} className="metadata-icon" aria-hidden="true" />
              <div className="metadata-content">
                <span className="metadata-label">예상 비용</span>
                <span className="metadata-value">{formatCost(response.cost_estimate)}</span>
              </div>
              <div className="metadata-trend" aria-hidden="true">
                {response.cost_estimate < 0.001 ? '💚' : response.cost_estimate < 0.01 ? '💛' : '💸'}
              </div>
            </div>
          </div>

          {/* Enhanced Performance Indicators */}
          <div className="performance-indicators" role="group" aria-label="성능 지표">
            <div className="performance-summary">
              <div className="overall-score">
                <span className="score-label">종합 점수</span>
                <div className="score-circle">
                  <span className="score-value">{performanceMetrics.overall}</span>
                </div>
              </div>
            </div>
            
            <div className="performance-details">
              <div className="performance-item">
                <div className="perf-header">
                  <span className="perf-label">응답 속도</span>
                  <span className="perf-score">{performanceMetrics.speedScore}/100</span>
                </div>
                <div className="perf-bar" role="progressbar" 
                     aria-valuenow={performanceMetrics.speedScore} 
                     aria-valuemin="0" 
                     aria-valuemax="100"
                     aria-label={`응답 속도 ${performanceMetrics.speedScore}점`}>
                  <div 
                    className="perf-fill speed-fill"
                    style={{ width: `${performanceMetrics.speedScore}%` }}
                  ></div>
                </div>
              </div>

              <div className="performance-item">
                <div className="perf-header">
                  <span className="perf-label">토큰 효율</span>
                  <span className="perf-score">{performanceMetrics.efficiencyScore}/100</span>
                </div>
                <div className="perf-bar" role="progressbar" 
                     aria-valuenow={performanceMetrics.efficiencyScore} 
                     aria-valuemin="0" 
                     aria-valuemax="100"
                     aria-label={`토큰 효율성 ${performanceMetrics.efficiencyScore}점`}>
                  <div 
                    className="perf-fill efficiency-fill"
                    style={{ width: `${performanceMetrics.efficiencyScore}%` }}
                  ></div>
                </div>
              </div>

              <div className="performance-item">
                <div className="perf-header">
                  <span className="perf-label">비용 효율</span>
                  <span className="perf-score">{performanceMetrics.costScore}/100</span>
                </div>
                <div className="perf-bar" role="progressbar" 
                     aria-valuenow={performanceMetrics.costScore} 
                     aria-valuemin="0" 
                     aria-valuemax="100"
                     aria-label={`비용 효율성 ${performanceMetrics.costScore}점`}>
                  <div 
                    className="perf-fill cost-fill"
                    style={{ width: `${performanceMetrics.costScore}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </article>
  );
});

// Display name for debugging
ArenaResponse.displayName = 'ArenaResponse';

export default ArenaResponse;