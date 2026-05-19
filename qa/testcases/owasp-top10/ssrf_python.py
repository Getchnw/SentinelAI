import requests
from flask import Flask, request

app = Flask(__name__)

@app.route('/fetch-image')
def fetch_image():
    image_url = request.args.get('url')
    
    # Vulnerable: Server-Side Request Forgery (SSRF) - fetching arbitrary URL provided by user
    response = requests.get(image_url)
    
    return response.content
