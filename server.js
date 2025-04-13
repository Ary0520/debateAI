const express = require("express");
const app = express();
const axios = require("axios");
const path = require("path");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Connect to MongoDB (with fallback for demo purposes)
let useMongoDb = true;

try {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => {
      console.error("MongoDB Connection Error:", err);
      console.log("Running in demo mode without MongoDB");
      useMongoDb = false;
    });
} catch (error) {
  console.error("MongoDB Connection Error:", error);
  console.log("Running in demo mode without MongoDB");
  useMongoDb = false;
}

// Define MongoDB Schemas and Models
const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const DebateSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true
  },
  stance: {
    type: String,
    enum: ['for', 'against', 'neutral'],
    default: 'neutral'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  messages: [MessageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
DebateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);
const Debate = mongoose.model('Debate', DebateSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// Helper function to get a debate response from Gemini
async function getDebateResponse(messages, topic, stance) {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Prepare the conversation history - convert 'assistant' role to 'model'
    const chatHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Create a chat session
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.6,
        topP: 0.85,
        topK: 30,
        maxOutputTokens: 1000,
      },
    });

    // Prepare the system prompt based on the debate stance
    let systemPrompt = `You are a virtual debate partner discussing the topic: "${topic}". `;

    if (stance === 'for') {
      systemPrompt += `you should argue strongly FOR this position, with convincing and strong arguments, with proofs, when necessary.`;
    } else if (stance === 'against') {
      systemPrompt += `You should argue strongly AGAINST this position with compelling arguments, evidence, and persuasive rhetoric. Challenge the user's supporting viewpoints respectfully but firmly.`;
    } else {
      systemPrompt += `You should play devil's advocate, challenging the user's arguments regardless of which side they take. Provide balanced perspectives and help them strengthen their reasoning.`;
    }

    // Send the message to the model
    const result = await chat.sendMessage(systemPrompt);
    const response = result.response;

    return response.text();
  } catch (error) {
    console.error('Error getting response from Gemini:', error);

    // Fallback responses based on stance
    const fallbackResponses = {
      for: [
        `I strongly support the position on ${topic}. There are numerous compelling reasons why this stance is valid. First, considering the evidence available, we can see clear benefits. Second, historical precedents show positive outcomes when this approach is taken. What specific aspects would you like to challenge?`,
        `As a proponent of this position on ${topic}, I believe the advantages are clear. Research consistently shows positive outcomes, and experts in the field generally agree on its merits. I'd be interested to hear your counterarguments so we can explore this topic further.`
      ],
      against: [
        `I must disagree with the position on ${topic}. The evidence suggests several significant problems with this approach. First, there are practical concerns about implementation. Second, there are ethical considerations that cannot be overlooked. What makes you support this position?`,
        `I find myself strongly opposed to this stance on ${topic}. Critical analysis reveals fundamental flaws in the reasoning, and the potential negative consequences outweigh any benefits. I'm curious about what aspects of this position you find compelling?`
      ],
      neutral: [
        `That's an interesting perspective on ${topic}. While there are valid points in your argument, we should also consider alternative viewpoints. Have you thought about the counterarguments? There are compelling points on both sides of this debate.`,
        `I see merit in some aspects of your position on ${topic}, but I also recognize valid counterpoints. A balanced analysis requires us to consider multiple perspectives. What do you think about the opposing arguments?`
      ]
    };

    // Select a random fallback response based on stance
    const stanceResponses = fallbackResponses[stance] || fallbackResponses.neutral;
    const randomIndex = Math.floor(Math.random() * stanceResponses.length);

    return stanceResponses[randomIndex];
  }
}

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

// API Routes

// In-memory storage for demo mode
const demoDebates = [];
const demoUsers = [];
let demoDebateIdCounter = 1;
let demoUserIdCounter = 1;

// Get all debates for a user
app.get("/api/debates", async (req, res) => {
  try {
    const userId = req.query.userId; // In a real app, get this from authenticated session

    if (useMongoDb) {
      let query = {};
      if (userId) {
        query.user = userId;
      }

      const debates = await Debate.find(query)
        .sort({ updatedAt: -1 })
        .select('topic stance createdAt updatedAt isActive');

      res.json(debates);
    } else {
      // Demo mode - use in-memory storage
      let debates = demoDebates;
      if (userId) {
        debates = demoDebates.filter(d => d.user === userId);
      }

      res.json(debates.map(d => ({
        _id: d._id,
        topic: d.topic,
        stance: d.stance,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        isActive: d.isActive
      })));
    }
  } catch (error) {
    console.error('Error fetching debates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific debate by ID
app.get("/api/debates/:id", async (req, res) => {
  try {
    if (useMongoDb) {
      const debate = await Debate.findById(req.params.id);

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      res.json(debate);
    } else {
      // Demo mode - use in-memory storage
      // Convert both to strings for comparison to ensure type safety
      const debate = demoDebates.find(d => String(d._id) === String(req.params.id));

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      res.json(debate);
    }
  } catch (error) {
    console.error('Error fetching debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new debate
app.post("/api/debates", async (req, res) => {
  try {
    const { topic, stance, userId } = req.body;

    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' });
    }

    // Generate an initial message from the AI to start the debate
    const initialPrompt = `Let's debate about "${topic}". I'll ${
      stance === 'for' ? 'argue for this position' :
      stance === 'against' ? 'argue against this position' :
      'play devil\'s advocate'
    }. Please start by sharing your initial thoughts.`;

    const aiResponse = await getDebateResponse(
      [{ role: 'user', content: initialPrompt }],
      topic,
      stance
    );

    if (useMongoDb) {
      const newDebate = new Debate({
        topic,
        stance: stance || 'neutral',
        user: userId || null,
        messages: [
          { role: 'user', content: initialPrompt },
          { role: 'assistant', content: aiResponse }
        ]
      });

      await newDebate.save();
      res.status(201).json(newDebate);
    } else {
      // Demo mode - use in-memory storage
      const newDebate = {
        _id: String(demoDebateIdCounter++),
        topic,
        stance: stance || 'neutral',
        user: userId || null,
        messages: [
          { role: 'user', content: initialPrompt },
          { role: 'assistant', content: aiResponse }
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      demoDebates.push(newDebate);
      res.status(201).json(newDebate);
    }
  } catch (error) {
    console.error('Error creating debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a message to a debate
app.post("/api/debates/:id/messages", async (req, res) => {
  try {
    const { content } = req.body;
    const debateId = req.params.id;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (useMongoDb) {
      // Find the debate
      const debate = await Debate.findById(debateId);

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      if (!debate.isActive) {
        return res.status(400).json({ message: 'This debate has been closed' });
      }

      // Add the user message
      debate.messages.push({
        role: 'user',
        content
      });

      // Get AI response
      const aiResponse = await getDebateResponse(
        debate.messages,
        debate.topic,
        debate.stance
      );

      // Add the AI response
      debate.messages.push({
        role: 'assistant',
        content: aiResponse
      });

      // Save the updated debate
      await debate.save();

      res.json({
        debateId: debate._id,
        messages: debate.messages.slice(-2) // Return just the new messages
      });
    } else {
      // Demo mode - use in-memory storage
      const debate = demoDebates.find(d => d._id === debateId);

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      if (!debate.isActive) {
        return res.status(400).json({ message: 'This debate has been closed' });
      }

      // Add the user message
      debate.messages.push({
        role: 'user',
        content,
        timestamp: new Date()
      });

      // Get AI response
      const aiResponse = await getDebateResponse(
        debate.messages,
        debate.topic,
        debate.stance
      );

      // Add the AI response
      debate.messages.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });

      // Update the debate
      debate.updatedAt = new Date();

      res.json({
        debateId: debate._id,
        messages: debate.messages.slice(-2) // Return just the new messages
      });
    }
  } catch (error) {
    console.error('Error adding message to debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close a debate
app.put("/api/debates/:id/close", async (req, res) => {
  try {
    if (useMongoDb) {
      const debate = await Debate.findById(req.params.id);

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      debate.isActive = false;
      await debate.save();

      res.json({ message: 'Debate closed successfully', debate });
    } else {
      // Demo mode - use in-memory storage
      const debate = demoDebates.find(d => d._id === req.params.id);

      if (!debate) {
        return res.status(404).json({ message: 'Debate not found' });
      }

      debate.isActive = false;
      debate.updatedAt = new Date();

      res.json({ message: 'Debate closed successfully', debate });
    }
  } catch (error) {
    console.error('Error closing debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User registration
app.post("/api/users/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (useMongoDb) {
      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create new user
      const newUser = new User({
        username,
        email,
        password
      });

      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email
      });
    } else {
      // Demo mode - use in-memory storage
      const existingUser = demoUsers.find(u => u.email === email || u.username === username);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create new user (simplified password handling for demo)
      const newUser = {
        _id: String(demoUserIdCounter++),
        username,
        email,
        password, // In a real app, this would be hashed
        createdAt: new Date()
      };

      demoUsers.push(newUser);

      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email
      });
    }
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User login
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (useMongoDb) {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email
      });
    } else {
      // Demo mode - use in-memory storage
      const user = demoUsers.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Simple password check for demo
      if (user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email
      });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});