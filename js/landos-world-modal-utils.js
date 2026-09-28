(() => {
  const activeLocks = new Map();
  let nextLockId = 0;
  let snapshot = null;

  function lockBackgroundScroll(owner = 'modal') {
    const token = `${owner}:${++nextLockId}`;
    if (!snapshot) {
      snapshot = {
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        htmlOverflow: document.documentElement.style.overflow,
        htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyLeft: document.body.style.left,
        bodyRight: document.body.style.right,
        bodyWidth: document.body.style.width,
        bodyOverflow: document.body.style.overflow,
        bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      };
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.position = 'fixed';
      document.body.style.top = `${-snapshot.scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
    }
    activeLocks.set(token, true);
    return token;
  }

  function unlockBackgroundScroll(token) {
    if (!activeLocks.delete(token) || activeLocks.size) return;
    const previous = snapshot;
    snapshot = null;
    if (!previous) return;
    document.documentElement.style.overflow = previous.htmlOverflow;
    document.documentElement.style.overscrollBehavior = previous.htmlOverscrollBehavior;
    document.body.style.position = previous.bodyPosition;
    document.body.style.top = previous.bodyTop;
    document.body.style.left = previous.bodyLeft;
    document.body.style.right = previous.bodyRight;
    document.body.style.width = previous.bodyWidth;
    document.body.style.overflow = previous.bodyOverflow;
    document.body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
    window.scrollTo?.(previous.scrollX, previous.scrollY);
  }

  function isEditableControl(element) {
    return Boolean(element)
      && (element.matches('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select, [contenteditable="true"]'));
  }

  function findScrollableAncestor(element) {
    let current = element?.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = window.getComputedStyle?.(current);
      const canScroll = style && /(auto|scroll|overlay)/.test(style.overflowY || '') && current.scrollHeight > current.clientHeight;
      if (canScroll) return current;
      current = current.parentElement;
    }
    return null;
  }

  function findExplicitModalScrollContainer(element) {
    let current = element?.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.matches?.('[data-modal-scroll-container]')) return current;
      current = current.parentElement;
    }
    return null;
  }

  function isWithinScrollContainer(element, container) {
    if (!element || !container) return false;
    if (element === container || container.contains?.(element)) return true;
    let current = element.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current === container) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isFixedViewportDescendant(element) {
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (window.getComputedStyle?.(current).position === 'fixed') return true;
      current = current.parentElement;
    }
    return false;
  }

  function isVisualViewportAlignedModalDescendant(element) {
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.matches?.('[data-modal-visual-viewport]')) return true;
      current = current.parentElement;
    }
    return false;
  }

  function ensureFocusedElementVisible(element, margin = 16, allowedScrollContainer = null) {
    if (!isEditableControl(element)) return false;
    const viewport = window.visualViewport;
    const fixedViewport = isFixedViewportDescendant(element);
    const viewportTop = fixedViewport && !isVisualViewportAlignedModalDescendant(element)
      ? 0
      : (viewport?.offsetTop || 0);
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const rect = element.getBoundingClientRect();
    const explicitScrollContainer = allowedScrollContainer
      ? (isWithinScrollContainer(element, allowedScrollContainer) ? allowedScrollContainer : null)
      : findExplicitModalScrollContainer(element);
    const scrollContainer = explicitScrollContainer || (allowedScrollContainer ? null : findScrollableAncestor(element));
    if (explicitScrollContainer && explicitScrollContainer.scrollHeight <= explicitScrollContainer.clientHeight) return false;
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const visibleTop = Math.max(viewportTop, containerRect.top);
      const visibleBottom = Math.min(viewportBottom, containerRect.bottom);
      if (rect.bottom > visibleBottom - margin) {
        scrollContainer.scrollTop += rect.bottom - visibleBottom + margin;
        return true;
      }
      if (rect.top < visibleTop + margin) {
        scrollContainer.scrollTop -= visibleTop - rect.top + margin;
        return true;
      }
      return false;
    }
    if (fixedViewport) return false;
    if (rect.bottom > viewportBottom - margin) {
      window.scrollBy?.(0, rect.bottom - viewportBottom + margin);
      return true;
    }
    if (rect.top < viewportTop + margin) {
      window.scrollBy?.(0, rect.top - viewportTop - margin);
      return true;
    }
    return false;
  }

  let visibilityFrame = 0;
  let userScrolledFocusedElement = null;
  let touchGestureStart = null;

  function isDocumentScrollFocusTarget(element) {
    return Boolean(element?.closest?.('[data-preserve-document-scroll-on-viewport-pan]'))
      && !findExplicitModalScrollContainer(element);
  }

  function elementFromEventTarget(target) {
    if (target?.nodeType === 1) return target;
    return target?.parentElement || null;
  }

  function markUserScrollIntent(eventTarget) {
    const activeElement = document.activeElement;
    if (!isDocumentScrollFocusTarget(activeElement)) return;
    const target = elementFromEventTarget(eventTarget);
    if (target?.closest?.('[data-modal-scroll-container], [data-modal-visual-viewport]')) return;
    userScrolledFocusedElement = activeElement;
  }

  function scheduleFocusedElementVisibility() {
    if (visibilityFrame) return;
    visibilityFrame = window.requestAnimationFrame?.(() => {
      visibilityFrame = 0;
      const activeElement = document.activeElement;
      if (activeElement === userScrolledFocusedElement) return;
      ensureFocusedElementVisible(activeElement);
    }) || 0;
  }

  function handleFocusIn(event) {
    if (event.target !== userScrolledFocusedElement) userScrolledFocusedElement = null;
    scheduleFocusedElementVisibility();
  }

  function scheduleFocusedElementVisibilityForViewportPan() {
    const activeElement = document.activeElement;
    const preservesDocumentScroll = activeElement?.closest?.('[data-preserve-document-scroll-on-viewport-pan]');
    if (preservesDocumentScroll && !findExplicitModalScrollContainer(activeElement)) return;
    scheduleFocusedElementVisibility();
  }

  function initializeFocusVisibility() {
    document.addEventListener?.('focusin', handleFocusIn);
    window.addEventListener?.('resize', scheduleFocusedElementVisibility, { passive: true });
    window.visualViewport?.addEventListener?.('resize', scheduleFocusedElementVisibility, { passive: true });
    // VisualViewport panning also occurs during ordinary document scrolling. A marked page
    // surface can retain native document scroll ownership, while explicit modal scroll owners
    // continue to receive focused-control visibility corrections.
    window.visualViewport?.addEventListener?.('scroll', scheduleFocusedElementVisibilityForViewportPan, { passive: true });
    document.addEventListener?.('wheel', (event) => {
      if (Math.abs(event.deltaY || 0) > 0) markUserScrollIntent(event.target);
    }, { passive: true, capture: true });
    document.addEventListener?.('touchstart', (event) => {
      const touch = event.touches?.[0];
      touchGestureStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true, capture: true });
    document.addEventListener?.('touchmove', (event) => {
      const touch = event.touches?.[0];
      if (!touch || !touchGestureStart) return;
      const deltaX = touch.clientX - touchGestureStart.x;
      const deltaY = touch.clientY - touchGestureStart.y;
      if (Math.abs(deltaY) >= 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        markUserScrollIntent(event.target);
        touchGestureStart = { x: touch.clientX, y: touch.clientY };
      }
    }, { passive: true, capture: true });
    const clearTouchGesture = () => { touchGestureStart = null; };
    document.addEventListener?.('touchend', clearTouchGesture, { passive: true, capture: true });
    document.addEventListener?.('touchcancel', clearTouchGesture, { passive: true, capture: true });
  }

  initializeFocusVisibility();

  window.LandosWorldModalUtils = Object.freeze({
    lockBackgroundScroll,
    unlockBackgroundScroll,
    ensureFocusedElementVisible,
  });
})();
