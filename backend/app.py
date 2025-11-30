from flask import Flask
from flask_cors import CORS
from routes import api_bp
from models import db
from flask_jwt_extended import JWTManager
import os

app = Flask(__name__)

# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Range"],
        "expose_headers": ["Content-Range", "X-Content-Range", "Accept-Ranges", "Content-Length"]
    }
})

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-this-in-prod' # Change this!

# Initialize Extensions
db.init_app(app)
jwt = JWTManager(app)

# Create DB Tables
from flask import Flask
from flask_cors import CORS
from routes import api_bp
from models import db
from flask_jwt_extended import JWTManager
import os

app = Flask(__name__)

# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Range"],
        "expose_headers": ["Content-Range", "X-Content-Range", "Accept-Ranges", "Content-Length"]
    }
})

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-this-in-prod' # Change this!

from datetime import timedelta
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=365) # Infinite session (1 year)

# Initialize Extensions
db.init_app(app)
jwt = JWTManager(app)

# Create DB Tables
with app.app_context():
    db.create_all()

app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)
    # Trigger reload, port=5000)
