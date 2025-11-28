from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    notes = db.relationship('Note', backref='user', lazy=True)
    folders = db.relationship('Folder', backref='user', lazy=True)

class Folder(db.Model):
    id = db.Column(db.String(36), primary_key=True) # UUID
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False, default="New Folder")
    color = db.Column(db.String(20), nullable=True)
    icon = db.Column(db.String(10), nullable=True, default='📁')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.relationship('Note', backref='folder', lazy=True)

class Note(db.Model):
    id = db.Column(db.String(36), primary_key=True) # UUID
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    folder_id = db.Column(db.String(36), db.ForeignKey('folder.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False, default="New Page")
    content = db.Column(db.Text, nullable=True, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    color = db.Column(db.String(20), nullable=True)
    icon = db.Column(db.String(10), nullable=True)
    is_hidden_from_top_bar = db.Column(db.Boolean, nullable=False, default=False)
    chats = db.relationship('ChatMessage', backref='note', lazy=True, cascade="all, delete-orphan")
    attachments = db.relationship('Attachment', backref='note', lazy=True, cascade="all, delete-orphan")

class Attachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.String(36), db.ForeignKey('note.id'), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    filepath = db.Column(db.String(200), nullable=False)
    filetype = db.Column(db.String(50), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    summary_status = db.Column(db.String(20), default='pending')  # pending, processing, complete, failed
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.String(36), db.ForeignKey('note.id'), nullable=False)
    sender = db.Column(db.String(10), nullable=False) # 'user' or 'assistant'
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)