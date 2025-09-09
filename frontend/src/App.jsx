import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import StudentSelfieRegistration from './components/StudentSelfieRegistration';
import ScanQR from './components/ScanQR';
import VerifyAttendance from './components/VerifyAttendance';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Attendance System</h1>
      <Routes>
        {/* Teacher Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Student Routes */}
        <Route path="/register" element={<StudentSelfieRegistration />} />
        <Route path="/scan" element={<ScanQR />} />
        <Route path="/verify/:qrToken" element={<VerifyAttendance />} />
        
        {/* Default route redirects to login */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;