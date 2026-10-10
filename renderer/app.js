console.log("typeof require in the page:", typeof require);

//call
// the "api.ping" is defined by the preload.js
window.api.ping("Maria").then((answer) => {
  document.getElementById("answer").textContent = answer;
});
