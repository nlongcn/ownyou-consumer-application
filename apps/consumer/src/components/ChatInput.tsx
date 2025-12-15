/**
 * ChatInput - Fixed bottom input bar for natural language agent requests
 *
 * Sprint 11b Bugfix 4: Add ChatInput component
 * v13 Section 3.x - Agent Trigger via Natural Language
 *
 * Uses TriggerContext.handleUserRequest() to process natural language
 * queries and trigger appropriate mission agents.
 */

import { useState, useCallback } from 'react';
import { useTrigger } from '../contexts/TriggerContext';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { handleUserRequest, isExecuting } = useTrigger();

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isExecuting) return;

    const trimmedInput = input.trim();
    setInput('');
    setLastResult(null);

    try {
      const result = await handleUserRequest(trimmedInput);
      if (result?.mission) {
        // Mission created - show brief feedback
        setLastResult(`Created mission: ${result.mission.title ?? 'New mission'}`);
        console.log('[ChatInput] Mission created:', result.mission.id);
      } else if (result?.skipped) {
        // Agent skipped the request
        setLastResult(result.skipReason ?? 'No mission generated');
      } else {
        setLastResult('Processing complete');
      }
    } catch (error) {
      console.error('[ChatInput] Request failed:', error);
      setLastResult('Request failed - please try again');
    }
  }, [input, handleUserRequest, isExecuting]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-40">
      {/* Result feedback */}
      {lastResult && (
        <div className="text-xs text-gray-600 mb-2 px-1">
          {lastResult}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask OwnYou anything..."
          disabled={isExecuting}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ownyou-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          aria-label="Chat input"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isExecuting}
          className="px-5 py-2 bg-ownyou-secondary text-white rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-opacity"
          aria-label="Send message"
        >
          {isExecuting ? (
            <span className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Thinking...
            </span>
          ) : (
            'Send'
          )}
        </button>
      </div>

      {/* Quick suggestions */}
      {!input && !isExecuting && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 max-w-2xl mx-auto">
          {[
            'Find me a good restaurant nearby',
            'Help me save money on groceries',
            'Plan a weekend trip',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="flex-shrink-0 px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
