import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Force Uppercase on all operator text inputs globally
document.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (!target) return;
  
  const isTextInput = target.tagName === 'INPUT' && (
    target.getAttribute('type') === 'text' || 
    !target.hasAttribute('type')
  );
  const isTextArea = target.tagName === 'TEXTAREA';

  if (isTextInput || isTextArea) {
    const originalValue = target.value;
    const upperValue = originalValue.toUpperCase();
    
    if (originalValue !== upperValue) {
      const start = target.selectionStart;
      const end = target.selectionEnd;

      // Bypass React's value tracking to ensure onChange triggers properly
      const prototype = target.tagName === 'INPUT' 
        ? window.HTMLInputElement.prototype 
        : window.HTMLTextAreaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      
      if (descriptor && descriptor.set) {
        descriptor.set.call(target, upperValue);
      } else {
        target.value = upperValue;
      }

      if (start !== null && end !== null) {
        target.setSelectionRange(start, end);
      }

      // Dispatch event to notify React's virtual DOM
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
