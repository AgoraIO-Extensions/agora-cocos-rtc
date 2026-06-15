function buildLocaleHref(targetLocale) {
  const { pathname } = window.location;
  if (targetLocale === 'zh') {
    return pathname.includes('/en/')
      ? pathname.replace('/en/', '/zh/')
      : pathname;
  }
  return pathname.includes('/zh/')
    ? pathname.replace('/zh/', '/en/')
    : pathname;
}

function bindLocaleSwitch() {
  document.querySelectorAll('[data-locale-target]').forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = buildLocaleHref(button.dataset.localeTarget);
    });
  });
}

function bindMobileNav() {
  const button = document.getElementById('nav-toggle');
  const nav = document.querySelector('.doc-nav');
  if (!button || !nav) return;

  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('is-open', !expanded);
  });
}

function buildToc() {
  const toc = document.getElementById('page-toc');
  const main = document.querySelector('.doc-main');
  if (!toc || !main) return;

  const headings = [...main.querySelectorAll('h2[id], h3[id]')];
  if (headings.length === 0) return;

  toc.innerHTML = headings
    .map((heading) => {
      const levelClass = heading.tagName === 'H3' ? 'toc-sub' : 'toc-top';
      return `<a class="${levelClass}" href="#${heading.id}">${heading.textContent}</a>`;
    })
    .join('');

  const linkById = new Map(
    [...toc.querySelectorAll('a')].map((link) => [link.getAttribute('href')?.slice(1), link]),
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = linkById.get(entry.target.id);
      if (!link) return;
      if (entry.isIntersecting) {
        toc.querySelectorAll('a').forEach((node) => node.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    });
  }, { rootMargin: '-25% 0px -60% 0px', threshold: 0.1 });

  headings.forEach((heading) => observer.observe(heading));
}

document.addEventListener('DOMContentLoaded', () => {
  bindLocaleSwitch();
  bindMobileNav();
  buildToc();
});
