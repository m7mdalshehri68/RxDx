// RxDx UI Enhancement Script

document.addEventListener('DOMContentLoaded', () => {
  // 1. Add Skip Link for Accessibility
  const skipLink = document.createElement('a');
  skipLink.href = '#rx-mainwrap';
  skipLink.className = 'rx-skip-link';
  skipLink.textContent = 'Skip to main content';
  document.body.insertBefore(skipLink, document.body.firstChild);

  // 2. Add Prototype Banner
  const shell = document.getElementById('rx-shell');
  if (shell) {
    const banner = document.createElement('div');
    banner.className = 'rx-proto-banner';
    banner.innerHTML = '<span>Prototype</span> This environment is for demonstration purposes and lacks clinical validation.';
    shell.insertBefore(banner, shell.firstChild);
  }

  // 3. Improve Workspace Chooser (Gate)
  const gateSub = document.querySelector('.rxg-sub');
  if (gateSub) {
    gateSub.textContent = 'Clinical reference & documentation — Select your workspace';
  }

  const gateNote = document.querySelector('.rxg-note');
  if (gateNote) {
    gateNote.textContent = 'Select a workspace above to continue. No login required for this prototype.';
  }

  // Ensure cards are keyboard accessible
  const gateCards = document.querySelectorAll('.rxg-card');
  gateCards.forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    
    // Add keyboard activation (Enter or Space)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // 4. Make all Sidebar Nav Items Keyboard Accessible
  const fixNavItems = () => {
    const navItems = document.querySelectorAll('.rxs-item');
    navItems.forEach(item => {
      if (!item.hasAttribute('tabindex')) {
        item.setAttribute('tabindex', '0');
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
          }
        });
      }
    });
  };
  
  // Since nav might be populated dynamically, run it once now and observe
  fixNavItems();
  const navContainer = document.getElementById('rx-nav');
  if (navContainer) {
    const observer = new MutationObserver(() => fixNavItems());
    observer.observe(navContainer, { childList: true });
  }

  // 5. Keyboard accessibility for other clickable elements
  const fixClickables = () => {
    const clickables = document.querySelectorAll('.hx-chip, .ed-p, .ed-ck, .icd-card, .drug-item, .uni-card, .hxs, .hxt');
    clickables.forEach(el => {
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
          }
        });
      }
    });
  };
  
  fixClickables();
  const mainWrap = document.querySelector('.main');
  if (mainWrap) {
    const observer = new MutationObserver(() => fixClickables());
    observer.observe(mainWrap, { childList: true, subtree: true });
  }
});
