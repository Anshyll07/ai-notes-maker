# AI Notes Maker

A premium AI-powered note-taking application with rich text editing, PDF support, and intelligent chat assistance.

## Features

- 📝 Rich text editor with advanced formatting
- 🤖 AI-powered chat assistant (Gemini 2.5 Flash)
- 📄 PDF attachment and context-aware responses
- 🎨 Beautiful dark mode UI with glassmorphism
- 📊 Tables, LaTeX math formulas, and code blocks
- 🎯 Drag-and-drop shapes and components
- 🔍 Google search integration for AI responses
- 📱 Responsive design
- 🗂️ Folder organization for notes

## Tech Stack

### Frontend
- React + TypeScript
- Vite
- TipTap (Rich text editor)
- KaTeX (Math rendering)
- Tailwind CSS (styling)

### Backend
- Python Flask
- SQLAlchemy (Database ORM)
- Google Gemini AI API
- JWT Authentication
- Flask-CORS

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- Python (v3.8+)
- Google Gemini API Key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Mac/Linux
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file:
```
GEMINI_API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_here
```

5. Run the server:
```bash
python app.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5174`

## Usage

1. **Create an account** or **log in**
2. **Create notes** with rich text formatting
3. **Upload PDFs** as attachments
4. **Chat with AI** for intelligent assistance
5. **Export notes** as PDF with proper formatting

## Features Showcase

- **LaTeX Math**: Write mathematical formulas using `$$` syntax
- **Code Blocks**: Syntax-highlighted code blocks
- **Tables**: Create and edit rich tables
- **Highlights**: Multiple highlight colors
- **PDF Export**: Export notes with all formatting preserved
- **AI Chat**: Context-aware responses using attached PDFs

## License

MIT License

## Author

Created with ❤️ using Gemini AI
