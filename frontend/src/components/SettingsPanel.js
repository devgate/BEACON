import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const SettingsPanel = ({ category, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
    chunk_size: 512,
    chunk_overlap: 50,
    chunk_strategy: 'sentence'
  });

  const [embeddingModels] = useState([
    { id: 'sentence-transformers/all-MiniLM-L6-v2', name: 'MiniLM-L6', size: '22.7M', description: '빠르고 가벼운 모델', language: 'multilingual' },
    { id: 'sentence-transformers/all-mpnet-base-v2', name: 'MPNet Base', size: '109M', description: '높은 정확도', language: 'english' },
    { id: 'sentence-transformers/multilingual-e5-base', name: 'E5 Multilingual', size: '278M', description: '다국어 지원', language: 'multilingual' }
  ]);

  useEffect(() => {
    if (category?.settings) {
      setSettings(category.settings);
    }
  }, [category]);

  const handleSave = async () => {
    // Validation
    if (settings.chunk_size < 128 || settings.chunk_size > 2048) {
      alert('청크 크기는 128-2048 사이여야 합니다.');
      return;
    }

    if (settings.chunk_overlap < 0 || settings.chunk_overlap > 200) {
      alert('청크 중복은 0-200 사이여야 합니다.');
      return;
    }

    if (settings.chunk_overlap >= settings.chunk_size) {
      alert('청크 중복은 청크 크기보다 작아야 합니다.');
      return;
    }

    try {
      await onSave(category.id, settings);
      alert('설정이 저장되었습니다.');
    } catch (error) {
      alert('설정 저장 중 오류가 발생했습니다.');
    }
  };

  const selectedModel = embeddingModels.find(m => m.id === settings.embedding_model);

  return (
    <aside className="settings-panel" style={{ display: 'flex' }}>
      <div className="settings-header">
        <h2>{category?.name} 설정</h2>
        <button className="close-settings-panel" onClick={onClose}>
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>돌아가기</span>
        </button>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h3>{category?.name} 카테고리 설정</h3>
          
          <div className="setting-group">
            <label htmlFor="embeddingModel">임베딩 모델:</label>
            <select 
              id="embeddingModel"
              className="setting-select"
              value={settings.embedding_model}
              onChange={(e) => setSettings({...settings, embedding_model: e.target.value})}
            >
              {embeddingModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.size})
                </option>
              ))}
            </select>
            {selectedModel && (
              <div className="setting-description">
                <strong>{selectedModel.description}</strong><br />
                언어: {selectedModel.language === 'multilingual' ? '다국어 지원' : '영어'}<br />
                크기: {selectedModel.size}
              </div>
            )}
          </div>

          <div className="setting-group">
            <label htmlFor="chunkSize">청크 크기:</label>
            <input 
              type="number"
              id="chunkSize"
              className="setting-input"
              min="128"
              max="2048"
              step="64"
              value={settings.chunk_size}
              onChange={(e) => setSettings({...settings, chunk_size: parseInt(e.target.value)})}
            />
            <div className="setting-description">
              문서를 나누는 단위의 크기 (128-2048 토큰)
            </div>
          </div>

          <div className="setting-group">
            <label htmlFor="chunkOverlap">청크 중복:</label>
            <input 
              type="number"
              id="chunkOverlap"
              className="setting-input"
              min="0"
              max="200"
              step="10"
              value={settings.chunk_overlap}
              onChange={(e) => setSettings({...settings, chunk_overlap: parseInt(e.target.value)})}
            />
            <div className="setting-description">
              인접한 청크 간의 중복 토큰 수 (0-200)
            </div>
          </div>

          <div className="setting-group">
            <label htmlFor="chunkStrategy">청킹 전략:</label>
            <select 
              id="chunkStrategy"
              className="setting-select"
              value={settings.chunk_strategy}
              onChange={(e) => setSettings({...settings, chunk_strategy: e.target.value})}
            >
              <option value="sentence">문장 단위</option>
              <option value="paragraph">문단 단위</option>
              <option value="section">섹션 단위</option>
              <option value="fixed">고정 크기</option>
            </select>
            <div className="setting-description">
              문서를 나누는 방식을 선택합니다.
            </div>
          </div>
        </div>
      </div>
      
      <div className="settings-footer">
        <button className="btn-cancel" onClick={onClose}>취소</button>
        <button className="btn-save" onClick={handleSave}>저장</button>
      </div>
    </aside>
  );
};

export default SettingsPanel;