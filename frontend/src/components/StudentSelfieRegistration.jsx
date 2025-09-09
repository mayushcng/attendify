import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import api from '../api'; // <-- This line is changed

const StudentSelfieRegistration = () => {
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [level, setLevel] = useState('Year 1');
  const [message, setMessage] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      setMessage("Loading models, please wait...");
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        setMessage("Models loaded. You can now capture your face.");
      } catch (error) {
        console.error("Error loading models:", error);
        setMessage("Error loading models.");
      }
    };
    loadModels();
  }, []);

  const startCapture = () => {
    setIsCapturing(true);
    setFaceDescriptor(null);
    setSelfieImage(null);
    setMessage('Starting webcam...');
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => {
        videoRef.current.srcObject = stream;
        setMessage('Look at the camera and hold still.');
      })
      .catch(err => {
        console.error("error:", err);
        setMessage('Could not start webcam. Please allow camera access.');
        setIsCapturing(false);
      });
  };

  const handleVideoPlay = async () => {
    if (videoRef.current && videoRef.current.readyState >= 3) {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (detection) {
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const selfieDataUrl = canvas.toDataURL('image/jpeg');
        setSelfieImage(selfieDataUrl);
        setFaceDescriptor(detection.descriptor);
        setMessage('✅ Face and selfie captured successfully! You can now register.');
        setIsCapturing(false);
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      } else {
        setTimeout(() => handleVideoPlay(), 200);
      }
    } else {
      setTimeout(() => handleVideoPlay(), 200);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!faceDescriptor || !selfieImage) {
      setMessage('Please capture a face and selfie first.');
      return;
    }
    try {
      const studentData = {
        name,
        roll,
        level,
        class_id: 'default_class',
        face_embedding: Array.from(faceDescriptor),
        selfie_image: selfieImage
      };
      const response = await api.post('/api/students/register', studentData);
      setMessage(response.data.message);
      setName(''); setRoll(''); setLevel('Year 1'); setFaceDescriptor(null); setSelfieImage(null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div>
      <h3>Student Self-Registration</h3>
      <form onSubmit={handleSubmit}>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required /><br />
        <input type="text" value={roll} onChange={e => setRoll(e.target.value)} placeholder="Roll Number" required /><br />
        <select value={level} onChange={e => setLevel(e.target.value)}>
          <option value="Year 1">Year 1</option>
          <option value="Year 2">Year 2</option>
          <option value="Year 3">Year 3</option>
          <option value="IPC">IPC</option>
        </select><br/>
        <button
          type="button"
          onClick={startCapture}
          disabled={!modelsLoaded || isCapturing}
        >
          {modelsLoaded ? (faceDescriptor ? 'Re-capture Face & Selfie' : 'Capture Face & Selfie') : 'Loading Models...'}
        </button>
        <button type="submit" disabled={!faceDescriptor}>Register</button>
      </form>
      <p style={{ fontWeight: 'bold' }}>{message}</p>
      {isCapturing && <video ref={videoRef} onPlay={handleVideoPlay} autoPlay muted width="320" height="240" />}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      {selfieImage && (
        <div>
          <h4>Your Captured Selfie:</h4>
          <img src={selfieImage} alt="Captured Selfie" width="160" />
        </div>
      )}
    </div>
  );
};

export default StudentSelfieRegistration;