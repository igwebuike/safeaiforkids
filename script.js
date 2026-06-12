function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.querySelector('input').value;
  const msg = document.getElementById('formMessage');
  msg.textContent = `Thanks! ${email} has been added to the NovaVerse launch list.`;
  form.reset();
  return false;
}
