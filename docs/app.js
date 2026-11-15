// Nav hairline once the page has moved, and the link of the section on screen.
const nav = document.querySelector('.nav');
const links = [...document.querySelectorAll('.nav-links a')];
const sections = links
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);
let ticking = false;

function sync() {
  nav.classList.toggle('is-scrolled', window.scrollY > 12);

  const line = window.scrollY + window.innerHeight * 0.4;
  let current = null;
  for (const s of sections) {
    if (s.offsetTop <= line) current = s;
  }
  for (const a of links) {
    a.classList.toggle('is-current', current && a.getAttribute('href') === '#' + current.id);
  }
  ticking = false;
}

window.addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sync);
  },
  { passive: true },
);

sync();
