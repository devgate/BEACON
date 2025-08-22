"""
Miscellaneous API endpoints for BEACON
Handles weather and other utility endpoints
"""
from flask import Blueprint, jsonify, render_template

# Create Blueprint
misc_bp = Blueprint('misc', __name__)

@misc_bp.route('/')
def index():
    """Serve the main index page"""
    return render_template('index.html')

@misc_bp.route('/api/weather')
def get_weather():
    """Get sample weather data"""
    return jsonify({
        'temperature': '3°C',
        'location': '안양시 동구',
        'condition': '흐림',
        'range': '5°C/-1°C'
    })