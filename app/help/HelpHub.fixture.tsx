/**
 * HelpHub fixture for React Cosmos
 */
import HelpHub from './HelpHub';
import { useState } from 'react';

export default {
  'Help Hub - Introduction': () => {
    const [isOpen, setIsOpen] = useState(true);
    
    return (
      <div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Open Help
        </button>
        <HelpHub isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    );
  },
  'Help Hub - Recycling': () => {
    const [isOpen, setIsOpen] = useState(true);
    
    // Mock search params to start on recycling topic
    window.history.replaceState({}, '', '?topic=recycling');
    
    return (
      <div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Open Help
        </button>
        <HelpHub isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    );
  },
};
