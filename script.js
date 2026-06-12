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

// After deploying the backend on Render, set this to your backend URL.
// Example: https://safeaiforkids-api.onrender.com
const API_BASE_URL = window.SAFEAIFORKIDS_API_URL || 'https://safeaiforkids-api.onrender.com';

function setFormMessage(message, isError = false) {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.style.color = isError ? '#ffdfdf' : '#d9fff4';
}

if (waitlistForm) {
  waitlistForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = waitlistForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const audience = document.getElementById('audience').value;

    if (!email) {
      setFormMessage('Please enter a valid email address.', true);
      return;
    }

    try {
      submitButton.disabled = true;
      submitButton.textContent = 'Joining...';
      setFormMessage('Saving your spot...');

      const response = await fetch(`${API_BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          audience,
          source: window.location.hostname || 'safeaiforkids.com'
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not save your email.');
      }

      setFormMessage(data.message || 'You are on the launch list. Welcome to the NovaVerse!');
      waitlistForm.reset();
    } catch (error) {
      setFormMessage('We could not save your email yet. Please try again in a moment.', true);
      console.error('Waitlist signup failed:', error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Join Waitlist';
    }
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
