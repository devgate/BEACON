# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BEACON is a Flask-based RAG (Retrieval-Augmented Generation) chat application with a modern web interface. The application provides an AI assistant interface for document-based question answering with features like:

- Document management and selection
- Real-time chat interface with AI responses
- Weather widget integration
- Chat history tracking
- Responsive design with Korean language support

## Architecture

### Backend (Flask)
- **app.py**: Main Flask application with REST API endpoints
  - `/` - Serves the main HTML interface
  - `/api/documents` - Returns document list
  - `/api/chat` - Handles chat messages with simple response logic
  - `/api/chat/history` - Returns chat history
  - `/api/weather` - Returns sample weather data

### Frontend
- **templates/index.html**: Main HTML template with responsive layout
- **static/script.js**: JavaScript client using RAGManager class
  - Handles chat interactions
  - Manages document selection
  - Loads weather data
  - Provides real-time messaging interface
- **static/style.css**: Complete responsive styling with dark theme

### Data Structure
- Documents stored as in-memory list with id/title structure
- Chat history stored in-memory with timestamp/message pairs
- Weather data served as static sample data

## Development Commands

### Setup and Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

### Running the Application
- **Development server**: `python app.py`
- **Default URL**: http://localhost:5000
- **Configuration**: Debug mode enabled, accessible on all interfaces (0.0.0.0:5000)

### Dependencies
Core Flask stack:
- Flask 2.3.3
- Flask-CORS 4.0.0
- requests 2.31.0
- python-dotenv 1.0.0

## Code Patterns

### Flask Route Structure
- All API routes prefixed with `/api/`
- JSON responses using `jsonify()`
- POST requests expect JSON payloads
- Simple response logic based on keyword matching

### Frontend JavaScript
- Class-based architecture with RAGManager
- Event-driven UI interactions
- Fetch API for backend communication
- Dynamic DOM manipulation for chat interface

### Styling Approach
- CSS custom properties for theming
- Flexbox-based responsive layout
- Dark theme with cyan (#00d4ff) accent color
- Mobile-first responsive design with sidebar toggle

## Korean Language Support
- UI elements and responses support Korean text
- Sample data includes Korean document titles
- User interface text mixed Korean/English for business context