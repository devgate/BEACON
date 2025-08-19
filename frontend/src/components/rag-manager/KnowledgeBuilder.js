import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faChevronDown, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

const KnowledgeBuilder = ({ selectedIndex, kbSettings, setKbSettings }) => {
  return (
    <div className="knowledge-builder-content">
      <div className="kb-header">
        <span className="kb-title">
          <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
        </span>
        <button className="btn-save-kb">Save</button>
      </div>

      <div className="kb-sections">
        {/* Embedding Section */}
        <div className="kb-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>Embedding</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Embedding Model</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.embeddingModel}
                onChange={(e) => setKbSettings({...kbSettings, embeddingModel: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Partition Section */}
        <div className="kb-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>Partition</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Strategy</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.strategy}
                onChange={(e) => setKbSettings({...kbSettings, strategy: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Hi Res Model Name</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.hiResModelName}
                onChange={(e) => setKbSettings({...kbSettings, hiResModelName: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Extract Images</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kbSettings.extractImages}
                  onChange={(e) => setKbSettings({...kbSettings, extractImages: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Extract Image Block to Payload</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kbSettings.extractImageBlock}
                  onChange={(e) => setKbSettings({...kbSettings, extractImageBlock: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Skip Infer Table Types</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.skipInferTableTypes}
                onChange={(e) => setKbSettings({...kbSettings, skipInferTableTypes: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Chunking Section */}
        <div className="kb-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>Chunking</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Chunking Strategy</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.chunkingStrategy}
                onChange={(e) => setKbSettings({...kbSettings, chunkingStrategy: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Chunking Mode</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.chunkingMode}
                onChange={(e) => setKbSettings({...kbSettings, chunkingMode: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Max Characters</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kbSettings.maxCharacters}
                  onChange={(e) => setKbSettings({...kbSettings, maxCharacters: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKbSettings({...kbSettings, maxCharacters: kbSettings.maxCharacters - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKbSettings({...kbSettings, maxCharacters: kbSettings.maxCharacters + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>New After N Chars</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kbSettings.newAfterNChars}
                  onChange={(e) => setKbSettings({...kbSettings, newAfterNChars: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKbSettings({...kbSettings, newAfterNChars: kbSettings.newAfterNChars - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKbSettings({...kbSettings, newAfterNChars: kbSettings.newAfterNChars + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Combine Text Under N Chars</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kbSettings.combineTextUnderNChars}
                  onChange={(e) => setKbSettings({...kbSettings, combineTextUnderNChars: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKbSettings({...kbSettings, combineTextUnderNChars: kbSettings.combineTextUnderNChars - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKbSettings({...kbSettings, combineTextUnderNChars: kbSettings.combineTextUnderNChars + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Languages</label>
              <input 
                type="text" 
                className="form-input"
                value={kbSettings.languages}
                onChange={(e) => setKbSettings({...kbSettings, languages: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Title Reg-Expression</label>
              <textarea 
                className="form-textarea"
                placeholder="Chunking Strategy에서 by_title(reg-expression)를 선택하세요."
                value={kbSettings.titleRegExpression}
                onChange={(e) => setKbSettings({...kbSettings, titleRegExpression: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBuilder;