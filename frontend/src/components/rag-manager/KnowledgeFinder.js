import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faChevronDown, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

const KnowledgeFinder = ({ selectedIndex, kfSettings, setKfSettings }) => {
  return (
    <div className="knowledge-finder-content">
      <div className="kf-header">
        <span className="kf-title">
          <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
        </span>
        <button className="btn-save-kf">Save</button>
      </div>

      <div className="kf-sections">
        {/* Rank Fusion Section */}
        <div className="kf-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>Rank Fusion</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Fusion Algorithm</label>
              <input 
                type="text" 
                className="form-input"
                value={kfSettings.fusionAlgorithm}
                onChange={(e) => setKfSettings({...kfSettings, fusionAlgorithm: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Reranker</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.reranker}
                  onChange={(e) => setKfSettings({...kfSettings, reranker: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Reranker Endpoint</label>
              <input 
                type="text" 
                className="form-input"
                value={kfSettings.rerankerEndpoint}
                onChange={(e) => setKfSettings({...kfSettings, rerankerEndpoint: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* RAG-Fusion Section */}
        <div className="kf-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>RAG-Fusion</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Rag Fusion</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.ragFusion}
                  onChange={(e) => setKfSettings({...kfSettings, ragFusion: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Query Augmentation Size</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kfSettings.queryAugmentationSize}
                  onChange={(e) => setKfSettings({...kfSettings, queryAugmentationSize: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKfSettings({...kfSettings, queryAugmentationSize: kfSettings.queryAugmentationSize - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKfSettings({...kfSettings, queryAugmentationSize: kfSettings.queryAugmentationSize + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HyDE Section */}
        <div className="kf-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>HyDE</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Hyde</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.hyde}
                  onChange={(e) => setKfSettings({...kfSettings, hyde: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Hyde Query</label>
              <input 
                type="text" 
                className="form-input"
                value={kfSettings.hydeQuery}
                onChange={(e) => setKfSettings({...kfSettings, hydeQuery: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* ETC Section */}
        <div className="kf-section">
          <div className="section-toggle">
            <FontAwesomeIcon icon={faChevronDown} />
            <span>ETC</span>
          </div>
          <div className="section-content">
            <div className="form-group">
              <label>Hybrid Search Debugger</label>
              <input 
                type="text" 
                className="form-input"
                value={kfSettings.hybridSearchDebugger}
                onChange={(e) => setKfSettings({...kfSettings, hybridSearchDebugger: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Filter</label>
              <input 
                type="text" 
                className="form-input"
                value={kfSettings.filter}
                onChange={(e) => setKfSettings({...kfSettings, filter: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Ensemble Weight</label>
              <input 
                type="range" 
                className="form-range"
                min="0"
                max="1"
                step="0.1"
                value={kfSettings.ensembleWeight}
                onChange={(e) => setKfSettings({...kfSettings, ensembleWeight: parseFloat(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label>Minimum Should Match</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kfSettings.minShouldMatch}
                  onChange={(e) => setKfSettings({...kfSettings, minShouldMatch: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKfSettings({...kfSettings, minShouldMatch: kfSettings.minShouldMatch - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKfSettings({...kfSettings, minShouldMatch: kfSettings.minShouldMatch + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Return Doc. Count (K)</label>
              <div className="input-with-controls">
                <input 
                  type="number" 
                  className="form-input"
                  value={kfSettings.returnDocCount}
                  onChange={(e) => setKfSettings({...kfSettings, returnDocCount: parseInt(e.target.value)})}
                />
                <div className="input-controls">
                  <button onClick={() => setKfSettings({...kfSettings, returnDocCount: kfSettings.returnDocCount - 1})}>
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button onClick={() => setKfSettings({...kfSettings, returnDocCount: kfSettings.returnDocCount + 1})}>
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Parent Document</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.parentDocument}
                  onChange={(e) => setKfSettings({...kfSettings, parentDocument: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Complex Doc.</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.complexDoc}
                  onChange={(e) => setKfSettings({...kfSettings, complexDoc: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Async Mode</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.asyncMode}
                  onChange={(e) => setKfSettings({...kfSettings, asyncMode: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="form-group">
              <label>Verbose</label>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={kfSettings.verbose}
                  onChange={(e) => setKfSettings({...kfSettings, verbose: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeFinder;