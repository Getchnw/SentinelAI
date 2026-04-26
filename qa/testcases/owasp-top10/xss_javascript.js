// Vulnerable reflected XSS sample
function renderComment(input) {
  document.getElementById("output").innerHTML = input;
}
