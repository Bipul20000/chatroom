require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

// Import models
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? "https://chatroom-20-eu2a35zyg-bipuldtu-gmailcoms-projects.vercel.app" 
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Store active users in memory (for real-time features)
let activeUsers = new Set();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  // Send recent messages to new user (last 50 messages)
  socket.on('get_messages', async () => {
    try {
      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();
      
      // Reverse to show oldest first
      socket.emit('previous_messages', messages.reverse());
    } catch (error) {
      console.error('Error fetching messages:', error);
      socket.emit('previous_messages', []);
    }
  });
  
  // Handle user joining
  socket.on('user_joined', async (username) => {
    try {
      // Add to active users
      activeUsers.add(username);
      socket.username = username;
      
      // Update or create user in database
      await User.findOneAndUpdate(
        { username },
        { 
          username,
          lastSeen: new Date(),
          isOnline: true 
        },
        { upsert: true, new: true }
      );
      
      // Create system message
      const systemMessage = new Message({
        username: 'System',
        text: `${username} joined the chat`,
        isSystem: true
      });
      await systemMessage.save();
      
      // Broadcast to all users
      io.emit('new_message', {
        id: systemMessage._id,
        username: systemMessage.username,
        text: systemMessage.text,
        timestamp: systemMessage.timestamp,
        isSystem: systemMessage.isSystem
      });
      
      // Send current active users list
      io.emit('users_list', Array.from(activeUsers));
      
    } catch (error) {
      console.error('Error handling user join:', error);
    }
  });
  
  // Handle new messages
  socket.on('send_message', async (messageData) => {
    try {
      console.log('Received message from client:', messageData);
      
      // Create and save message to database
      const message = new Message({
        username: messageData.username,
        text: messageData.text
      });
      
      const savedMessage = await message.save();
      console.log('Message saved to database:', savedMessage);
      
      // Broadcast to all connected clients
      const messageToSend = {
        id: savedMessage._id,
        username: savedMessage.username,
        text: savedMessage.text,
        timestamp: savedMessage.timestamp,
        isSystem: savedMessage.isSystem
      };
      
      io.emit('new_message', messageToSend);
      console.log('Message broadcasted to all clients');
      
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });
  
  // Handle user disconnect
  socket.on('disconnect', async () => {
    if (socket.username) {
      try {
        // Remove from active users
        activeUsers.delete(socket.username);
        
        // Update user status in database
        await User.findOneAndUpdate(
          { username: socket.username },
          { 
            lastSeen: new Date(),
            isOnline: false 
          }
        );
        
        // Create system message
        const systemMessage = new Message({
          username: 'System',
          text: `${socket.username} left the chat`,
          isSystem: true
        });
        await systemMessage.save();
        
        // Broadcast to remaining users
        socket.broadcast.emit('new_message', {
          id: systemMessage._id,
          username: systemMessage.username,
          text: systemMessage.text,
          timestamp: systemMessage.timestamp,
          isSystem: systemMessage.isSystem
        });
        
        io.emit('users_list', Array.from(activeUsers));
        
      } catch (error) {
        console.error('Error handling user disconnect:', error);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Health check endpoint for deployment
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});