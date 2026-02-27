from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import os
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from deepface import DeepFace
import pickle

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Face recognition using DeepFace (supports multiple models)
data_path = "faces"
encodings_file = "face_encodings.pkl"
known_face_encodings = []
known_face_names = []
known_face_paths = []

# DeepFace model (options: VGG-Face, Facenet, Facenet512, OpenFace, DeepFace, DeepID, ArcFace, Dlib)
MODEL_NAME = "Facenet512"  # Using FaceNet512 for best accuracy

def load_face_encodings():
    """Load face encodings from pickle file"""
    global known_face_encodings, known_face_names, known_face_paths
    
    if os.path.exists(encodings_file):
        with open(encodings_file, 'rb') as f:
            data = pickle.load(f)
            known_face_encodings = data['encodings']
            known_face_names = data['names']
            known_face_paths = data['paths']
        print(f"✓ Loaded {len(known_face_encodings)} face encodings")
    else:
        print("No existing encodings found. Will create new.")

def save_face_encodings():
    """Save face encodings to pickle file"""
    data = {
        'encodings': known_face_encodings,
        'names': known_face_names,
        'paths': known_face_paths
    }
    with open(encodings_file, 'wb') as f:
        pickle.dump(data, f)
    print(f"✓ Saved {len(known_face_encodings)} face encodings")

def train_model():
    """Train face recognition model using DeepFace"""
    global known_face_encodings, known_face_names, known_face_paths
    
    known_face_encodings = []
    known_face_names = []
    known_face_paths = []
    
    if not os.path.exists(data_path):
        os.makedirs(data_path)
        return False
    
    print("\n" + "="*50)
    print(f"Training {MODEL_NAME} model...")
    print("="*50)
    
    # Load training images
    for file in os.listdir(data_path):
        if file.lower().endswith((".jpg", ".png", ".jpeg")):
            path = os.path.join(data_path, file)
            
            # Extract name from filename (remove extension and trailing numbers)
            name_with_ext = file.split(".")[0]
            import re
            name = re.sub(r'\d+$', '', name_with_ext)
            
            print(f"Processing: {file} -> Name: {name}")
            
            try:
                # Get face embedding using DeepFace
                embedding_objs = DeepFace.represent(
                    img_path=path,
                    model_name=MODEL_NAME,
                    enforce_detection=False
                )
                
                if len(embedding_objs) > 0:
                    embedding = embedding_objs[0]["embedding"]
                    known_face_encodings.append(embedding)
                    known_face_names.append(name)
                    known_face_paths.append(path)
                    print(f"  ✓ Encoded successfully ({len(embedding)}D vector)")
                else:
                    print(f"  ✗ No face detected in image")
            except Exception as e:
                print(f"  ✗ Error: {str(e)}")
    
    if len(known_face_encodings) > 0:
        save_face_encodings()
        print(f"\n✓ Training complete: {len(known_face_encodings)} faces encoded")
        print(f"✓ Registered users: {list(set(known_face_names))}")
        print("="*50 + "\n")
        return True
    else:
        print("✗ No faces found for training")
        return False

# Load or train model on startup
load_face_encodings()
if len(known_face_encodings) == 0:
    train_model()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/detect_face_live', methods=['POST'])
def detect_face_live():
    """Real-time face detection for mesh overlay"""
    try:
        data = request.json
        image_data = data['image']
        
        # Decode base64 image
        image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to OpenCV format
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(50, 50)
        )
        
        if len(faces) > 0:
            # Get the first face
            (x, y, w, h) = faces[0]
            
            # Detect facial features
            eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_eye.xml"
            )
            
            roi_gray = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray)
            
            eye_positions = []
            for (ex, ey, ew, eh) in eyes[:2]:  # Get first 2 eyes
                eye_positions.append({
                    'x': int(x + ex + ew/2),
                    'y': int(y + ey + eh/2)
                })
            
            return jsonify({
                'success': True,
                'face': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'eyes': eye_positions
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No face detected'
            })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        })

@app.route('/authenticate', methods=['POST'])
def authenticate():
    try:
        print("\n" + "="*50)
        print("🔐 AUTHENTICATION REQUEST RECEIVED")
        print("="*50)
        
        data = request.json
        image_data = data['image']
        
        print(f"Image data length: {len(image_data)}")
        
        # Decode base64 image
        image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        # Save temporary image
        temp_path = "temp_auth.jpg"
        image.save(temp_path)
        
        print("Processing face recognition...")
        
        try:
            # Get face embedding
            embedding_objs = DeepFace.represent(
                img_path=temp_path,
                model_name=MODEL_NAME,
                enforce_detection=False
            )
            
            if len(embedding_objs) == 0:
                os.remove(temp_path)
                print("✗ No face detected in image")
                print("="*50 + "\n")
                return jsonify({
                    'success': False,
                    'message': 'No face detected'
                })
            
            test_embedding = np.array(embedding_objs[0]["embedding"])
            
            # Calculate cosine similarity with all known faces
            best_match_idx = -1
            best_similarity = -1
            
            for idx, known_embedding in enumerate(known_face_encodings):
                known_emb = np.array(known_embedding)
                
                # Cosine similarity
                similarity = np.dot(test_embedding, known_emb) / (
                    np.linalg.norm(test_embedding) * np.linalg.norm(known_emb)
                )
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_idx = idx
            
            os.remove(temp_path)
            
            if best_match_idx >= 0:
                print(f"Best match: {known_face_names[best_match_idx]}")
                print(f"Similarity: {best_similarity:.4f}")
            
            # Similarity threshold (higher = stricter, 0.5-0.7 is good)
            if best_similarity > 0.5:
                name = known_face_names[best_match_idx]
                confidence = best_similarity * 100
                
                print(f"✓ AUTHENTICATION SUCCESS!")
                print(f"✓ Recognized as: {name} ({confidence:.1f}% confidence)")
                print("="*50 + "\n")
                
                return jsonify({
                    'success': True,
                    'name': name,
                    'confidence': float(confidence)
                })
            else:
                print(f"✗ Similarity too low: {best_similarity:.4f}")
                print("="*50 + "\n")
                return jsonify({
                    'success': False,
                    'message': 'Face not recognized',
                    'confidence': float(best_similarity * 100) if best_similarity > 0 else 0
                })
        
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
    
    except Exception as e:
        print(f"✗ Error during authentication: {str(e)}")
        print("="*50 + "\n")
        return jsonify({
            'success': False,
            'message': str(e)
        })

@app.route('/capture', methods=['POST'])
def capture():
    try:
        print("\n" + "="*50)
        print("📸 CAPTURE REQUEST RECEIVED")
        print("="*50)
        
        data = request.json
        image_data = data['image']
        name = data.get('name', 'user')
        
        print(f"Name: {name}")
        print(f"Image data length: {len(image_data)}")
        
        # Decode base64 image
        image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        # Save image
        os.makedirs(data_path, exist_ok=True)
        
        # Count existing images for this user
        count = len([f for f in os.listdir(data_path) if f.startswith(name)])
        filename = f"{name}{count + 1}.jpg"
        filepath = os.path.join(data_path, filename)
        
        image.save(filepath)
        print(f"✓ Saved image: {filename}")
        
        # Retrain model with new image
        train_model()
        
        print("✓ Registration complete - sending success response")
        print("="*50 + "\n")
        
        return jsonify({
            'success': True,
            'message': f'Image saved as {filename}',
            'filename': filename
        })
    
    except Exception as e:
        print(f"✗ Error during capture: {str(e)}")
        print("="*50 + "\n")
        return jsonify({
            'success': False,
            'message': str(e)
        })

if __name__ == '__main__':
    print("\n" + "🚀"*25)
    print("🔐 CYBER FACE AUTHENTICATION SERVER")
    print("🚀"*25)
    print(f"\n📊 Status:")
    print(f"  • Registered users: {list(set(known_face_names))}")
    print(f"  • Total face encodings: {len(known_face_encodings)}")
    print(f"  • Model: {MODEL_NAME}")
    print(f"\n🌐 Server starting on http://localhost:5000")
    print("="*50 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
