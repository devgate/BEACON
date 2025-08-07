import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faComments, faCogs, faUserCircle, faCog, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

const Header = ({ activeTab, setActiveTab }) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <FontAwesomeIcon icon={faRobot} />
          <span className="logo-text">BEACON</span>
        </div>
        <nav className="main-nav">
          <button 
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <FontAwesomeIcon icon={faComments} />
            <span>Chat</span>
          </button>
          <button 
            className={`nav-tab ${activeTab === 'ragManager' ? 'active' : ''}`}
            onClick={() => setActiveTab('ragManager')}
          >
            <FontAwesomeIcon icon={faCogs} />
            <span>RAG Manager</span>
          </button>
        </nav>
      </div>
      <div className="header-right">
        <div className="user-info">
          <FontAwesomeIcon icon={faUserCircle} style={{ color: '#00d4ff' }} />
          <span>안녕하세요, SK 쩜드스 어드민님</span>
        </div>
        <div className="header-icons">
          <FontAwesomeIcon icon={faCog} />
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </div>
      </div>
    </header>
  );
};

export default Header;