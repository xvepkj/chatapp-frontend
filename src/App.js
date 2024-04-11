import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BASE_URL } from './apiConfig';
import './App.css';

function App() {
  const [token, setToken] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [friends, setFriends] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const ws = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      checkToken(storedToken);
      loadFriends(storedToken);
      loadUsers(storedToken);
    }
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(username, selectedUser);
    }
  }, [selectedUser]);

  const checkToken = async (token) => {
    try {
      const response = await axios.get(`${BASE_URL}/validate-token`, {
        headers: {
          Authorization: token,
        },
      });
      if (response.status === 200) {
        setLoggedIn(true);
        setUsername(response.data.username);
        connectWebSocket();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      setLoggedIn(false);
      localStorage.removeItem('token');
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await axios.post(`${BASE_URL}/users/login`, {
        username,
        password,
      });
      if (response.status === 200) {
        localStorage.setItem('token', response.data.user.Token);
        setToken(response.data.user.Token);
        setLoggedIn(true);
        setUsername(username);
        loadFriends(response.data.user.Token);
        loadUsers(response.data.user.Token);
        connectWebSocket();
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async (username, password) => {
    try {
      const response = await axios.post(`${BASE_URL}/users/register`, {
        username,
        password,
      });
      if (response.status === 201) {
        handleLogin(username, password);
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setLoggedIn(false);
    setUsername('');
    setPassword('');
    setFriends([]);
    setUsers([]);
    setSelectedUser(null);
    setMessages([]);
    setNewMessage('');
    setWsConnected(false);
    setSearchTerm('');
    localStorage.removeItem('token');
    if (ws.current) {
      ws.current.close(1000, 'User logged out');
    }
  };

  const loadFriends = async (token) => {
    try {
      const response = await axios.get(`${BASE_URL}/friends`, {
        headers: {
          Authorization: token,
        },
      });
      setFriends(response.data.users);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadUsers = async (token) => {
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        headers: {
          Authorization: token,
        },
      });
      setUsers(response.data.users.filter(user => user !== username));
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (senderID, receiverID) => {
    try {
      const response = await axios.get(`${BASE_URL}/messages/${senderID}/${receiverID}`, {
        headers: {
          Authorization: token,
        },
      });
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    if (!wsConnected) {
      connectWebSocket();
      setTimeout(() => {
        ws.current.send(
          JSON.stringify({
            type: 'message',
            SenderID: username,
            ReceipientID: selectedUser,
            content: newMessage,
          })
        );
        setMessages((prevMessages) => [...prevMessages, { SenderID: username, Content: newMessage }]);
        setNewMessage('');
      }, 1000);
    } else {
      ws.current.send(
        JSON.stringify({
          type: 'message',
          SenderID: username,
          ReceipientID: selectedUser,
          content: newMessage,
        })
      );
      setMessages((prevMessages) => [...prevMessages, { SenderID: username, Content: newMessage }]);
      setNewMessage('');
    }
  };

  const connectWebSocket = () => {
    ws.current = new WebSocket(`ws://localhost:8080/ws`);

    ws.current.onopen = () => {
      setWsConnected(true);
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      console.log(event.data);
      const message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setWsConnected(false);
      // Reconnect to WebSocket if the connection is closed unintentionally
      if (event.code !== 1000) {
        setTimeout(connectWebSocket, 3000); // Try to reconnect after 3 seconds
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
  };

  const handleSearch = (searchTerm) => {
    setSearchTerm(searchTerm);
  };

  const filteredUsers = users ? users.filter((user) =>
    user.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (!token) {
    return (
      <div className="container">
        <h1>Login/Register</h1>
        <div className="form">
          <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" onClick={() => handleLogin(username, password)}>Login</button>
          <button className="btn" onClick={() => handleRegister(username, password)}>Register</button>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <div className="container">Validating token...</div>;
  }

  return (
    <div className="container">
      <h1>Welcome, {username}!</h1>
      <button className="btn" onClick={handleLogout}>Logout</button>

      <div className="chat-container">
        <div className="friends-list">
          <h2>Friends</h2>
          <ul>
            {friends && friends.map((friend) => (
              <li key={friend} onClick={() => setSelectedUser(friend)}>
                {friend}
              </li>
            ))}
          </ul>
        </div>

        <div className="search-users">
          <h2>Search Users</h2>
          <input 
            type="text" 
            placeholder="Search users..." 
            onChange={(e) => handleSearch(e.target.value)}
          />

          {searchTerm && (
            <ul>
              {filteredUsers.map((user) => (
                <li key={user} onClick={() => setSelectedUser(user)}>
                  {user}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedUser && (
          <div className="chat-box">
            <h2>{selectedUser}</h2>
            <ul className="messages">
              {messages.map((message, index) => (
                <li key={index}>
                  <strong>{message.SenderID}:</strong> {message.Content}
                </li>
              ))}
            </ul>

            <div className="message-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
              />
              <button className="btn" onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}

        {wsConnected ? (
          <p className="status">WebSocket connected</p>
        ) : (
          <p className="status">WebSocket disconnected</p>
        )}
      </div>
    </div>
  );
}

export default App;
