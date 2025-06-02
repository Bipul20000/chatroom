import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connection status listeners
    socket.on('connect', () => {
      console.log('Connected to server!');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // Listen for previous messages when joining
    socket.on('previous_messages', (prevMessages) => {
      console.log('Received previous messages:', prevMessages);
      setMessages(prevMessages);
    });

    // Listen for new messages
    socket.on('new_message', (message) => {
      console.log('Received new message:', message);
      setMessages(prev => [...prev, message]);
    });

    // Listen for user events
    socket.on('user_joined', (joinedUsername) => {
      console.log('User joined:', joinedUsername);
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'System',
        text: `${joinedUsername} joined the chat`,
        timestamp: new Date().toISOString(),
        isSystem: true
      }]);
    });

    socket.on('user_left', (leftUsername) => {
      console.log('User left:', leftUsername);
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'System',
        text: `${leftUsername} left the chat`,
        timestamp: new Date().toISOString(),
        isSystem: true
      }]);
    });

    socket.on('users_list', (usersList) => {
      console.log('Users list updated:', usersList);
      setUsers(usersList);
    });

    // Cleanup listeners on component unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('previous_messages');
      socket.off('new_message');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('users_list');
    };
  }, []);

  const joinChat = (e) => {
    e.preventDefault();
    if (username.trim()) {
      console.log('Joining chat as:', username);
      setIsJoined(true);
      socket.emit('user_joined', username);
      // Request previous messages when joining
      socket.emit('get_messages');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      console.log('Sending message:', { username, text: newMessage });
      socket.emit('send_message', {
        username: username,
        text: newMessage
      });
      setNewMessage('');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h1>Join Chat Room</h1>
          <div className="connection-status">
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <form onSubmit={joinChat}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
            />
            <button type="submit" disabled={!isConnected}>
              {isConnected ? 'Join Chat' : 'Connecting...'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <h3>Online Users ({users.length})</h3>
        <div className="connection-status">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <ul className="users-list">
          {users.map((user, index) => (
            <li key={index} className={user === username ? 'current-user' : ''}>
              {user}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="chat-main">
        <div className="chat-header">
          <h2>Chat Room</h2>
          <span className="username">Welcome, {username}!</span>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                className={`message ${message.isSystem ? 'system-message' : ''} ${
                  message.username === username ? 'own-message' : ''
                }`}
              >
                {!message.isSystem && (
                  <div className="message-header">
                    <span className="message-username">{message.username}</span>
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                )}
                <div className="message-text">{message.text}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            placeholder={isConnected ? "Type your message..." : "Reconnecting..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength={500}
            disabled={!isConnected}
          />
          <button type="submit" disabled={!isConnected || !newMessage.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;