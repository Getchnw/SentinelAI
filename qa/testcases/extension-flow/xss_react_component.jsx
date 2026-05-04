import React from "react";

export default function ProfileCard({ bioHtml }) {
  return (
    <div>
      <h2>User Bio</h2>
      {/* Vulnerable: unsanitized HTML can trigger XSS. */}
      <div dangerouslySetInnerHTML={{ __html: bioHtml }} />
    </div>
  );
}
