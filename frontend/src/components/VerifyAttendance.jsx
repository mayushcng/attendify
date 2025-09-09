import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api'; // <-- This line is changed
import * as faceapi from 'face-api.js';

const VerifyAttendance = () => {
  const { qrToken } = useParams();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [message, setMessage] = useState('Loading session details...');
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef();

  useEffect(() => {
    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
    };
    loadModels();
    
    const fetchData = async () => {
      try {
        const sessionRes = await api.get(`/api/session/${qrToken}`);
        setSession(sessionRes.data);
        const studentsRes = await api.get(`/api/students/class/${sessionRes.data.class_id}`);
        setStudents(studentsRes.data);
        setMessage('Please select your name and verify your face.');
      } catch (error) {
        setMessage(error.response?.data?.message || 'Failed to load session data.');
      }
    };
    fetchData();
  }, [qrToken]);

  const startCaptureAndVerify = () => {
    if (!selectedStudent) {
      setMessage('Please select your name first.');
      return;
    }
    setIsCapturing(true);
    setMessage('Starting webcam...');
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => { videoRef.current.srcObject = stream; })
      .catch(err => setMessage('Could not access webcam.'));
  };

  const handleVideoPlay = async () => {
    if (videoRef.current && videoRef.current.readyState >= 3) {
      setMessage('Detecting face...');
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (detection) {
        setMessage('Face detected. Verifying...');
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
        try {
          const attendanceData = {
            sessionId: session.id,
            studentId: selectedStudent,
            liveFaceEmbedding: Array.from(detection.descriptor)
          };
          const response = await api.post('/api/attendance/mark', attendanceData);
          setMessage(`✅ ${response.data.message}`);
        } catch (error) {
          setMessage(`❌ ${error.response?.data?.message || 'An error occurred.'}`);
        }
      } else {
        setTimeout(() => handleVideoPlay(), 200);
      }
    } else {
      setTimeout(() => handleVideoPlay(), 200);
    }
  };

  if (!session && students.length === 0) return <div><p>{message}</p></div>;

  return (
    <div>
      <h3>Verify Your Attendance</h3>
      <p>{message}</p>
      {!isCapturing && (
        <div>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">-- Select Your Name --</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>{student.name} ({student.roll})</option>
            ))}
          </select>
          <button onClick={startCaptureAndVerify} disabled={!selectedStudent}>Verify Face</button>
        </div>
      )}
      {isCapturing && <video ref={videoRef} onPlay={handleVideoPlay} autoPlay muted width="320" height="240" />}
    </div>
  );
};

export default VerifyAttendance;