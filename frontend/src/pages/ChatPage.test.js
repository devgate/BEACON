/**
 * Test suite for ChatPage AWS Agent Integration
 * Tests AWS Agent functionality in the chat interface following TDD principles
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatPage from './ChatPage';
import * as api from '../services/api';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock the API services
jest.mock('../services/api', () => ({
  chatService: {
    sendMessage: jest.fn()
  },
  bedrockService: {
    getHealth: jest.fn(),
    getModels: jest.fn()
  },
  documentService: {
    getDocuments: jest.fn(),
    getKnowledgeBases: jest.fn()
  },
  awsAgentService: {
    sendAgentMessage: jest.fn(),
    getAvailableAgents: jest.fn()
  }
}));

describe('ChatPage AWS Agent Integration', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock default responses
    api.bedrockService.getHealth.mockResolvedValue({
      status: 'healthy',
      rag_enabled: true
    });
    
    api.bedrockService.getModels.mockResolvedValue({
      models: [
        { model_id: 'anthropic.claude-3-haiku', name: 'Claude 3 Haiku' },
        { model_id: 'anthropic.claude-3-sonnet', name: 'Claude 3 Sonnet' }
      ]
    });
    
    api.documentService.getDocuments.mockResolvedValue({
      documents: []
    });
    
    api.documentService.getKnowledgeBases.mockResolvedValue({
      knowledge_bases: []
    });
    
    api.awsAgentService.getAvailableAgents.mockResolvedValue({
      agents: [
        {
          id: 'QFZOZZY6LA',
          alias_id: 'HZSY9X6YYZ',
          name: '기본 Agent',
          description: 'Default AWS Bedrock Agent'
        }
      ]
    });
  });

  test('should render AWS Agent option in source selector', async () => {
    render(<ChatPage />);
    
    // Wait for component to load and agents to be fetched
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Wait for agents to load
    await waitFor(() => {
      expect(api.awsAgentService.getAvailableAgents).toHaveBeenCalled();
    });
    
    // Find the source selector dropdown
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    expect(sourceSelector).toBeInTheDocument();
    
    // Check that AWS Agent option group exists
    await waitFor(() => {
      const optGroups = within(sourceSelector).getAllByRole('group');
      const awsAgentGroup = optGroups.find(group => 
        group.getAttribute('label') === '🤖 AWS Agent'
      );
      expect(awsAgentGroup).toBeInTheDocument();
    });
    
    // Check that default agent is listed
    await waitFor(() => {
      const agentOption = within(sourceSelector).getByText((content, element) => {
        return content && content.includes && content.includes('기본 Agent');
      });
      expect(agentOption).toBeInTheDocument();
    });
  });

  test('should show AWS Agent section after document-based section', async () => {
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    const optGroups = within(sourceSelector).getAllByRole('group');
    
    // Verify order: 문서 기반 should come before AWS Agent
    expect(optGroups[0].getAttribute('label')).toBe('📚 문서 기반');
    expect(optGroups[1].getAttribute('label')).toBe('🤖 AWS Agent');
  });

  test('should select AWS Agent when user chooses it from dropdown', async () => {
    render(<ChatPage />);
    
    // Wait for component to load and agents to be fetched
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Wait for agents to load
    await waitFor(() => {
      expect(api.awsAgentService.getAvailableAgents).toHaveBeenCalled();
    });
    
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    
    // Wait for the agent option to be available in the DOM
    await waitFor(() => {
      const agentOptions = within(sourceSelector).queryAllByText((content, element) => {
        return content && content.includes && content.includes('기본 Agent');
      });
      expect(agentOptions.length).toBeGreaterThan(0);
    });
    
    // Select the AWS Agent option
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    
    // Verify the selection is reflected immediately
    expect(sourceSelector.value).toBe('agent_QFZOZZY6LA');
  });

  test('should send message to AWS Agent when agent is selected', async () => {
    // Mock AWS Agent response
    api.awsAgentService.sendAgentMessage.mockResolvedValue({
      response: 'This is a response from AWS Agent',
      agent_id: 'QFZOZZY6LA',
      agent_alias_id: 'HZSY9X6YYZ',
      session_id: 'test-session-123',
      timestamp: new Date().toISOString()
    });
    
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Select AWS Agent
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    
    // Type a message
    const messageInput = screen.getByPlaceholderText('질문을 입력하세요...');
    fireEvent.change(messageInput, { target: { value: 'Test message for agent' } });
    
    // Send the message
    const sendButton = screen.getByRole('button');
    fireEvent.click(sendButton);
    
    // Verify AWS Agent service was called
    await waitFor(() => {
      expect(api.awsAgentService.sendAgentMessage).toHaveBeenCalledWith(
        'Test message for agent',
        expect.objectContaining({
          agent_id: 'QFZOZZY6LA',
          agent_alias_id: 'HZSY9X6YYZ'
        })
      );
    });
    
    // Verify the response is displayed
    await waitFor(() => {
      expect(screen.getByText('This is a response from AWS Agent')).toBeInTheDocument();
    });
  });

  test('should maintain session continuity for AWS Agent conversations', async () => {
    const sessionId = 'continuous-session-456';
    
    // Mock first response
    api.awsAgentService.sendAgentMessage.mockResolvedValueOnce({
      response: 'First response',
      agent_id: 'QFZOZZY6LA',
      agent_alias_id: 'HZSY9X6YYZ',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
    
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Select AWS Agent
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    
    // Send first message
    const messageInput = screen.getByPlaceholderText('질문을 입력하세요...');
    fireEvent.change(messageInput, { target: { value: 'First message' } });
    
    const sendButton = screen.getByRole('button');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('First response')).toBeInTheDocument();
    });
    
    // Mock second response
    api.awsAgentService.sendAgentMessage.mockResolvedValueOnce({
      response: 'Second response with context',
      agent_id: 'QFZOZZY6LA',
      agent_alias_id: 'HZSY9X6YYZ',
      session_id: sessionId,
      timestamp: new Date().toISOString()
    });
    
    // Send second message
    fireEvent.change(messageInput, { target: { value: 'Second message' } });
    fireEvent.click(sendButton);
    
    // Verify session ID is maintained in second call
    await waitFor(() => {
      expect(api.awsAgentService.sendAgentMessage).toHaveBeenLastCalledWith(
        'Second message',
        expect.objectContaining({
          session_id: sessionId
        })
      );
    });
    
    // Verify second response is displayed
    await waitFor(() => {
      expect(screen.getByText('Second response with context')).toBeInTheDocument();
    });
  });

  test('should display agent info card when AWS Agent is selected', async () => {
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Select AWS Agent
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    
    // Wait for agent info card to appear
    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return content.includes('활성 AWS Agent');
      })).toBeInTheDocument();
    });
    
    // Verify agent details are shown
    expect(screen.getByText('이름:')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return content.includes('기본 Agent');
    })).toBeInTheDocument();
    expect(screen.getByText('Agent ID:')).toBeInTheDocument();
    expect(screen.getByText('QFZOZZY6LA')).toBeInTheDocument();
  });

  test('should handle AWS Agent errors gracefully', async () => {
    // Mock error response
    api.awsAgentService.sendAgentMessage.mockRejectedValue(
      new Error('AWS Agent service unavailable')
    );
    
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });
    
    // Select AWS Agent
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    
    // Send a message
    const messageInput = screen.getByPlaceholderText('질문을 입력하세요...');
    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByRole('button');
    fireEvent.click(sendButton);
    
    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/죄송합니다. 오류가 발생했습니다/)).toBeInTheDocument();
    });
  });

  test('should switch between RAG and AWS Agent modes', async () => {
    render(<ChatPage />);
    
    await waitFor(() => {
      expect(screen.getByText('소스 선택')).toBeInTheDocument();
    });

    // Wait for agents to load
    await waitFor(() => {
      expect(api.awsAgentService.getAvailableAgents).toHaveBeenCalled();
    });
    
    const sourceSelector = screen.getByLabelText('지식 소스 선택');
    
    // Start with general chat
    expect(sourceSelector.value).toBe('');
    
    // Switch to AWS Agent
    fireEvent.change(sourceSelector, { target: { value: 'agent_QFZOZZY6LA' } });
    expect(sourceSelector.value).toBe('agent_QFZOZZY6LA');
    
    // Switch back to general chat
    fireEvent.change(sourceSelector, { target: { value: '' } });
    expect(sourceSelector.value).toBe('');
  });
});

describe('AWS Agent Service', () => {
  test('awsAgentService should be defined in api module', () => {
    expect(api.awsAgentService).toBeDefined();
    expect(api.awsAgentService.sendAgentMessage).toBeDefined();
    expect(api.awsAgentService.getAvailableAgents).toBeDefined();
  });
});