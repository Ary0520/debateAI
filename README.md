# AI Debate Partner

An interactive web application that lets users engage in structured debates with an AI powered by Google's Gemini Pro model. Users can choose debate topics and take different stances (for, against, or neutral) while the AI adapts its responses accordingly, creating a dynamic and engaging debate experience.

## Features

- **AI-Powered Debates**: Leverages Google's Gemini Pro model for intelligent, context-aware responses
- **Multiple Debate Stances**: Choose to argue for, against, or have the AI play devil's advocate
- **Real-time Interaction**: Smooth, chat-like interface for natural conversation flow
- **Fallback System**: Graceful degradation to ensure functionality even when AI service is unavailable
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **AI Integration**: Google Generative AI (Gemini Pro)
- **Authentication**: bcrypt for password hashing
- **Environment Variables**: dotenv for configuration

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your configuration:
   ```
   API_KEY=your_gemini_api_key
   MONGO_URI=your_mongodb_connection_string
   PORT=3000
   ```
4. Run the application: `npm start`
5. Visit `http://localhost:3000` in your browser

## Future Enhancements

- Real-time debate sessions with multiple users
- Enhanced AI response customization
- Integration with additional AI models
- Export debate transcripts
- Topic categorization and search functionality

