import React, { useState } from 'react';
import Header from './components/Header';
import ChatPage from './pages/ChatPage';
import RAGManagerPage from './pages/RAGManagerPage';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="app-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {activeTab === 'chat' ? (
        <ChatPage />
      ) : (
        <RAGManagerPage />
      )}
    </div>
  );
}

export default App;