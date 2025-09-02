import React, { useState } from 'react';
import Header from './components/Header';
import ChatPage from './pages/ChatPage';
import RAGManagerPage from './pages/RAGManagerPage';
import ArenaPage from './pages/ArenaPage';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'arena':
        return <ArenaPage />;
      case 'ragManager':
        return <RAGManagerPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <div className="app-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderActivePage()}
    </div>
  );
}

export default App;