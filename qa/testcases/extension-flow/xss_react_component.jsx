import React from 'react';

export default function ProfileCard({ bioHtml }) {
  return (
    <div className="profile-card">
      <h2>User Profile</h2>
      {/* Vulnerable: DOM-based XSS by rendering unsanitized HTML */}
      <div dangerouslySetInnerHTML={{ __html: bioHtml }} />
    </div>
  );
}
