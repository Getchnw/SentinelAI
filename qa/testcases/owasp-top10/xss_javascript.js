function displayComment(userComment) {
    // Vulnerable: DOM-based XSS by directly setting innerHTML without sanitization
    const commentSection = document.getElementById("comments");
    commentSection.innerHTML = "<div>" + userComment + "</div>";
}
