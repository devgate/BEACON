import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

const AIMaster = ({ selectedIndex, aiSettings, setAiSettings }) => {
  return (
    <div className="ai-master-content">
      <div className="ai-header">
        <span className="ai-title">
          <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
        </span>
        <button className="btn-save-ai">Save</button>
      </div>

      <div className="ai-form">
        <div className="form-group">
          <label>LLM Model ID</label>
          <input 
            type="text" 
            className="form-input"
            value={aiSettings.llmModelId}
            onChange={(e) => setAiSettings({...aiSettings, llmModelId: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Max Tokens</label>
          <div className="input-with-controls">
            <input 
              type="number" 
              className="form-input"
              value={aiSettings.maxTokens}
              onChange={(e) => setAiSettings({...aiSettings, maxTokens: parseInt(e.target.value)})}
            />
            <div className="input-controls">
              <button onClick={() => setAiSettings({...aiSettings, maxTokens: aiSettings.maxTokens - 1})}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <button onClick={() => setAiSettings({...aiSettings, maxTokens: aiSettings.maxTokens + 1})}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>Stop Sequences</label>
          <input 
            type="text" 
            className="form-input"
            value={aiSettings.stopSequences}
            onChange={(e) => setAiSettings({...aiSettings, stopSequences: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Temperature</label>
          <div className="input-with-controls">
            <input 
              type="number" 
              className="form-input"
              value={aiSettings.temperature}
              step="0.1"
              onChange={(e) => setAiSettings({...aiSettings, temperature: parseFloat(e.target.value)})}
            />
            <div className="input-controls">
              <button onClick={() => setAiSettings({...aiSettings, temperature: Math.max(0, aiSettings.temperature - 0.1)})}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <button onClick={() => setAiSettings({...aiSettings, temperature: aiSettings.temperature + 0.1})}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>Top K</label>
          <div className="input-with-controls">
            <input 
              type="number" 
              className="form-input"
              value={aiSettings.topK}
              onChange={(e) => setAiSettings({...aiSettings, topK: parseInt(e.target.value)})}
            />
            <div className="input-controls">
              <button onClick={() => setAiSettings({...aiSettings, topK: aiSettings.topK - 1})}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <button onClick={() => setAiSettings({...aiSettings, topK: aiSettings.topK + 1})}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>Top P</label>
          <div className="input-with-controls">
            <input 
              type="number" 
              className="form-input"
              value={aiSettings.topP}
              step="0.01"
              onChange={(e) => setAiSettings({...aiSettings, topP: parseFloat(e.target.value)})}
            />
            <div className="input-controls">
              <button onClick={() => setAiSettings({...aiSettings, topP: Math.max(0, aiSettings.topP - 0.01)})}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <button onClick={() => setAiSettings({...aiSettings, topP: Math.min(1, aiSettings.topP + 0.01)})}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>인덱스 프롬프트</label>
          <textarea 
            className="form-textarea prompt-textarea"
            value={aiSettings.prompt}
            onChange={(e) => setAiSettings({...aiSettings, prompt: e.target.value})}
          />
        </div>
        <div className="prompt-action">
          <button className="btn-prompt-submit">프롬프트 테스트 조회</button>
        </div>
      </div>
    </div>
  );
};

export default AIMaster;