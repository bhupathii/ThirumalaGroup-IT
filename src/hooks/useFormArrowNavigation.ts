import { useEffect } from 'react';

/**
 * Hook to enable left/right arrow navigation between logical form fields.
 * 
 * @param formRef Ref pointing to the form or wrapper element.
 * @param enabled Whether arrow navigation is active.
 */
export const useFormArrowNavigation = (
  formRef: React.RefObject<HTMLFormElement | HTMLDivElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 3. Keep existing Tab and Shift+Tab behavior unchanged.
      if (e.key === 'Tab') return;

      const isLeft = e.key === 'ArrowLeft';
      const isRight = e.key === 'ArrowRight';

      if (!isLeft && !isRight) return;

      const form = formRef.current;
      if (!form) return;

      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement || !form.contains(activeElement)) return;

      // 5. Do not interfere with:
      // - Textarea cursor movement
      if (activeElement.tagName.toLowerCase() === 'textarea') {
        return;
      }

      // - Dropdown option navigation
      const isDropdownOpen = 
        activeElement.getAttribute('aria-expanded') === 'true' || 
        !!document.querySelector('[role="listbox"]');
      if (isDropdownOpen) return;

      // - Date picker navigation
      const isCalendarOpen = !!document.querySelector('.CustomCalendar');
      if (isCalendarOpen) return;

      // Get all inputs, select, button, and elements with tabindex inside form
      const allElements = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [tabindex]'
        )
      );

      // Filter down to the logical focusable order matching Tab navigation
      const focusable = allElements.filter(el => {
        // 6. Skip hidden and disabled fields automatically
        if (el.tabIndex === -1) return false;

        const inputEl = el as HTMLInputElement;
        if (inputEl.disabled) return false;

        if (inputEl.type === 'hidden') return false;

        // Verify visibility in DOM
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        return true;
      });

      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (isRight) {
        nextIndex = (currentIndex + 1) % focusable.length;
      } else if (isLeft) {
        nextIndex = (currentIndex - 1 + focusable.length) % focusable.length;
      }

      if (nextIndex !== currentIndex) {
        // 9. Prevent page scrolling
        e.preventDefault();
        const nextElement = focusable[nextIndex];
        nextElement.focus();

        // 8. Select existing value for quick overwrite in text/numeric fields
        if (nextElement instanceof HTMLInputElement) {
          const type = nextElement.type;
          if (
            type === 'text' ||
            type === 'number' ||
            type === 'email' ||
            type === 'tel' ||
            type === 'search' ||
            type === 'url'
          ) {
            setTimeout(() => {
              try {
                nextElement.select();
              } catch (err) {
                // Fail silently if type doesn't support selection
              }
            }, 50);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [formRef, enabled]);
};
