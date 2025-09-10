import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import api from '../api';

const StudentSelfieRegistration = () => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Year 1');
  const [message, setMessage] = useState('');
  // ... (rest of the state variables are the same)
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!faceDescriptor || !selfieImage) {
      setMessage('Please capture a face and selfie first.');
      return;
    }
    try {
      // We create a unique roll number automatically
      const uniqueRollNumber = `${name.replace(/\s+/g, '')}-${Date.now()}`;
      
      const studentData = {
        name,
        roll: uniqueRollNumber, // <-- Use the auto-generated roll number
        level,
        class_id: 'default_class',
        face_embedding: Array.from(faceDescriptor),
        selfie_image: selfieImage
      };
      const response = await api.post('/api/students/register', studentData);
      setMessage(response.data.message);
      setName(''); setLevel('Year 1'); setFaceDescriptor(null); setSelfieImage(null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div>
      <h3>Student Self-Registration</h3>
      <form onSubmit={handleSubmit}>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required /><br />
        {/* Roll Number input is now removed */}
        <select value={level} onChange={e => setLevel(e.target.value)}>
          <option value="Year 1">Year 1</option>
          <option value="Year 2">Year 2</option>
          <option value="Year 3">Year 3</option>
          <option value="IPC">IPC</option>
        </select><br/>
        {/* ... (rest of the JSX is the same) ... */}
      </form>
    </div>
  );
};
export default StudentSelfieRegistration;