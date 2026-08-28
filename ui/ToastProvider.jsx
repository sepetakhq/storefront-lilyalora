import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

const DURATION = 2200;

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);

  const showToast = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), DURATION);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={showToast}>
      <ToastMessageContext.Provider value={message}>{children}</ToastMessageContext.Provider>
    </ToastContext.Provider>
  );
}

const ToastMessageContext = createContext('');

export function useToast() {
  return useContext(ToastContext);
}

export function useToastMessage() {
  return useContext(ToastMessageContext);
}
