import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const [qrCodeData, setQrCodeData] = useState(null);
  const [timer, setTimer] = useState(0);
  const [unverifiedStudents, setUnverifiedStudents] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const intervalRef = useRef(null); // Ref to hold the interval ID

  const fetchUnverifiedStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/api/students/unverified', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnverifiedStudents(response.data);
    } catch (error) {
      console.error('Error fetching unverified students:', error);
    }
  };

  useEffect(() => {
    fetchUnverifiedStudents();
    // Cleanup interval when the component is unmounted
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  
  const fetchAttendance = async (sessionId) => {
    try {
        const token = localStorage.getItem('token');
        const response = await api.get(`/api/attendance/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setLiveAttendance(response.data);
    } catch (error) {
        console.error("Failed to fetch attendance", error);
    }
  };

  useEffect(() => {
    let countdownInterval;
    if (timer > 0) {
      countdownInterval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && qrCodeData) {
      setQrCodeData(null);
      if (intervalRef.current) clearInterval(intervalRef.current); // Stop polling
    }
    return () => clearInterval(countdownInterval);
  }, [timer, qrCodeData]);
  
  const handleApprove = async (studentId) => {
    try {
      const token = localStorage.getItem('token');
      await api.put(`/api/students/verify/${studentId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUnverifiedStudents();
    } catch (error) {
      console.error('Error approving student:', error);
      alert('Failed to approve student.');
    }
  };

  const handleGenerateQR = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current); // Clear any old polling interval
    try {
      const token = localStorage.getItem('token');
      const response = await api.post('/api/sessions/create', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const { qrCodeToken, sessionId } = response.data;
      setQrCodeData({ qrCodeToken, sessionId });
      setLiveAttendance([]);
      setTimer(120);
      
      // Start polling for new attendance
      intervalRef.current = setInterval(() => {
        fetchAttendance(sessionId);
      }, 5000); // Check for new attendance every 5 seconds

    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Error generating QR code. Your login might be expired.');
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Welcome, Teacher!</h2>
        <button onClick={handleLogout} style={{ height: '30px' }}>Logout</button>
      </div>
      <Link to="/register">Register a New Student</Link>
      <hr />
      <p>Click the button to generate a new QR code for attendance. It will be valid for 2 minutes.</p>
      {!qrCodeData && (
        <button onClick={handleGenerateQR}>Generate New QR Code</button>
      )}
      {qrCodeData && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <QRCodeSVG value={qrCodeData.qrCodeToken} size={256} />
          <h3>Time remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</h3>
        </div>
      )}
      <hr />
      <h3>Live Attendance ({liveAttendance.length})</h3>
      <ul>
        {liveAttendance.map((att, index) => (
          <li key={index}>{att.name} ({att.roll}) - Marked at {new Date(att.verified_at).toLocaleTimeString()}</li>
        ))}
      </ul>
      <hr />
      <h3>Pending Student Approvals</h3>
      {unverifiedStudents.length > 0 ? (
        <ul>
          {unverifiedStudents.map(student => (
            <li key={student.id}>
              {student.name} ({student.roll})
              <button onClick={() => handleApprove(student.id)} style={{ marginLeft: '10px' }}>Approve</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No students are currently awaiting approval.</p>
      )}
    </div>
  );
}

export default Dashboard;