import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faRefresh, faHome } from '@fortawesome/free-solid-svg-icons';
import './ArenaErrorBoundary.css';

class ArenaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Arena Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReload = () => {
    // Reset error state and reload the component
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    // Navigate to home page (if routing is available)
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon-wrapper">
              <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
            </div>
            
            <div className="error-content">
              <h2>Arena에서 오류가 발생했습니다</h2>
              <p>죄송합니다. AI 모델 비교 중에 예상치 못한 오류가 발생했습니다.</p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="error-details">
                  <summary>오류 상세 정보 (개발 모드)</summary>
                  <pre className="error-stack">
                    {this.state.error.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            
            <div className="error-actions">
              <button 
                onClick={this.handleReload}
                className="error-btn primary"
                aria-label="Arena 페이지를 다시 로드합니다"
              >
                <FontAwesomeIcon icon={faRefresh} />
                다시 시도
              </button>
              
              <button 
                onClick={this.handleGoHome}
                className="error-btn secondary"
                aria-label="홈 페이지로 이동합니다"
              >
                <FontAwesomeIcon icon={faHome} />
                홈으로 이동
              </button>
            </div>
            
            <div className="error-help">
              <p>문제가 계속 발생하면:</p>
              <ul>
                <li>페이지를 새로고침해 보세요</li>
                <li>브라우저 캐시를 지워보세요</li>
                <li>다른 브라우저에서 시도해 보세요</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Display name for debugging
ArenaErrorBoundary.displayName = 'ArenaErrorBoundary';

export default ArenaErrorBoundary;