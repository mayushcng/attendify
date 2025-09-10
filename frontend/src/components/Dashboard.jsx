// ... (imports and component logic are the same)
// Just change these two lines in the JSX:

// In the live attendance list:
<li key={index}>{att.name} - Marked at {new Date(att.verified_at).toLocaleTimeString()}</li>

// In the pending approvals list:
<li key={student.id}>
  {student.name}
  <button onClick={() => handleApprove(student.id)} style={{ marginLeft: '10px' }}>Approve</button>
</li>