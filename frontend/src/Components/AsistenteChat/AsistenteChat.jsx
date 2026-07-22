import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AsistenteChat.css';
import { ReactComponent as CloseIcon } from '../../assets/icons/close.svg';
import { ReactComponent as ChatIcon } from '../../assets/asistente/message-circle.svg';
import apiClient from '../../axiosConfig';

const AsistenteChat = () => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  // Saludo inicial
  useEffect(() => {
    if (open) {
      setMessages([{
        sender: 'bot',
        text: '¡Hola! Soy tu asistente de gimnasio. ¿En qué puedo ayudarte hoy?'
      }]);
    } else {
      setMessages([]);
    }
  }, [open]);

  // Scroll automático
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChat = () => setOpen(o => !o);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    // 1) Mensaje del usuario
    setMessages(ms => [...ms, { sender: 'user', text }]);
    setInputValue('');

    // 2) Ponemos placeholder “Pensando…”
    setIsTyping(true);
    setMessages(ms => [...ms, { sender: 'bot', text: 'Pensando…' }]);

    try {
      // 3) Llamada a la API
      const { data } = await apiClient.post(
        '/asistente/prompt',
        { question: text }
      );

      const fullResponse = data.response;
      // 4) Animar escritura carácter a carácter
      let idx = 0;
      // Eliminamos el placeholder “Pensando…” y añadimos un mensaje vacío
      setMessages(ms => {
        const copy = [...ms];
        copy.pop();
        return [...copy, { sender: 'bot', text: '' }];
      });

      const typer = setInterval(() => {
        idx++;
        setMessages(ms => {
          const copy = [...ms];
          copy[copy.length - 1].text = fullResponse.slice(0, idx);
          return copy;
        });
        if (idx >= fullResponse.length) {
          clearInterval(typer);
          setIsTyping(false);
        }
      }, 30); // 30ms por carácter (ajusta velocidad)

    } catch (err) {
      // En caso de error, reemplazamos el placeholder con mensaje de error
      setMessages(ms => {
        const copy = [...ms];
        copy.pop();
        return [...copy, {
          sender: 'bot',
          text: 'Ups, hubo un error de conexión. Por favor, intentá de nuevo.'
        }];
      });
      console.error(err);
      setIsTyping(false);
    }
  };

  return (
    <>
      {open ? (
        <div className="assistant-chat-window">
          <div className="assistant-header">
            <p> Coach y soporte </p>
            <button className="assistant-close" onClick={toggleChat}>
              <CloseIcon width={30} />
            </button>
          </div>
          <div className="assistant-messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.sender}`}>
                {m.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="assistant-input">
            <input
              type="text"
              placeholder="Escribí tu mensaje..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              className="send-button"
              disabled={isTyping}
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <div className="bubble-wrapper">
          <div className="assistant-bubble" onClick={toggleChat}>
            Consultas fitness
            <ChatIcon color='#FAFAFA' width={16} height={16} />
          </div>
        </div>
      )}
    </>
  );
};

export default AsistenteChat;