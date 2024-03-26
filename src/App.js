import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BASE_URL } from './apiConfig';

function App() {
  const [token, setToken] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  const ws = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      checkToken(storedToken);
      loadFriends(storedToken);
    }
  }, []);

  useEffect(() => {
    if (selectedFriend) {
      loadMessages(username, selectedFriend);
    }
  }, [selectedFriend]);

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
    setSelectedFriend(null);
    setMessages([]);
    setNewMessage('');
    setWsConnected(false);
    localStorage.removeItem('token');
    if (ws.current) {
      ws.current.close(1000, 'User logged out'); // Close the WebSocket connection with code 1000 and reason 'User logged out'
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
            ReceipientID: selectedFriend,
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
          ReceipientID: selectedFriend,
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


  if (!token) {
    return (
      <div>
        <h1>Login/Register</h1>
        <div>
          <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => handleLogin(username, password)}>Login</button>
          <button onClick={() => handleRegister(username, password)}>Register</button>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <div>Validating token...</div>;
  }

  return (
    <div>
      <h1>Welcome, {username}!</h1>
      <button onClick={handleLogout}>Logout</button>

      <h2>Friends</h2>
      <ul>
        {friends.map((friend) => (
          <li key={friend} onClick={() => setSelectedFriend(friend)}>
            {friend}
          </li>
        ))}
      </ul>

      {selectedFriend && (
        <div>
          <h2>{selectedFriend}</h2>
          <ul>
            {messages.map((message, index) => (
              <li key={index}>
                <strong>{message.SenderID}:</strong> {message.Content}
              </li>
            ))}
          </ul>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      )}
    </div>
  );
}

export default App;
