# Article to Video Monorepo

A multi-user application that transforms article URLs into engaging videos.

## Project Structure
- `frontend/`: Next.js web application (Port 3000)
- `backend/`: FastAPI REST API (Port 8000)
- `worker/`: Python background worker for video processing

## Prerequisites
- **Node.js**: v18 or higher
- **Python**: v3.9 or higher
- **Homebrew**: For managing packages on Mac

## First-time Setup (Mac)
1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Install Python & Node**:
   ```bash
   brew install python node
   ```
3. **Setup Backend**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Setup Worker**:
   ```bash
   cd worker
   python3 -m venv venv
   source venv/bin/activate
   pip install -r ../backend/requirements.txt # Reuse backend deps or create specific ones
   ```
5. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   ```

## Running Locally
You will need three terminal windows/tabs:

**Terminal 1: Backend**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 3: Worker**
```bash
cd worker
source venv/bin/activate
python main.py
```

## Environment Variables
Create a `.env` file in each directory based on the `.env.example` in the root.

## Verification
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000/health](http://localhost:8000/health)
