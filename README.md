# INSTRUCTIONS TO RUN

# BACKEND

cd ai-engine

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows use: .\venv\Scripts\activate

# Install required AI and web libraries
pip install -r requirements.txt

# IN POWERSHELL (TERMINAL FOR LINUX/MAC)
# Set your Gemini API Key and start the server
export GOOGLE_API_KEY="your_gemini_api_key_here"
uvicorn main:app --reload --port 8000

# FRONTEND

cd server

# Install Node dependencies
npm install

# IN POWERSHELL (TERMINAL FOR LINUX/MAC)
# Set your Firebase secrets and start the development server
export VITE_FIREBASE_API_KEY="your_api_key" <br>
export VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"<br>
export VITE_FIREBASE_PROJECT_ID="your_project_id"<br>
export VITE_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"<br>
export VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"<br>
export VITE_FIREBASE_APP_ID="your_app_id"<br>
export VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"<br>

npm run dev
