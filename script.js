const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));
}

const revealItems = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });
revealItems.forEach(item => observer.observe(item));

const waitlistForm = document.getElementById('waitlistForm');
const formMessage = document.getElementById('formMessage');
if (waitlistForm) {
  waitlistForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const audience = document.getElementById('audience').value;
    const existing = JSON.parse(localStorage.getItem('safeaiforkids_waitlist') || '[]');
    existing.push({ email, audience, joinedAt: new Date().toISOString() });
    localStorage.setItem('safeaiforkids_waitlist', JSON.stringify(existing));
    formMessage.textContent = 'You are on the launch list. Welcome to the NovaVerse!';
    waitlistForm.reset();
  });
}

document.querySelectorAll('.tilt-card').forEach(card => {
  card.addEventListener('mousemove', (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'; });
});
