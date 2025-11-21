'use client';

import { useCallback, useState, KeyboardEvent, ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmailRecipientInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function EmailRecipientInput({
  value,
  onChange,
  label = 'To',
  placeholder = 'Enter email addresses...',
  disabled = false,
  error,
}: EmailRecipientInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const addEmail = useCallback(
    (email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return;
      }

      if (!isValidEmail(trimmed)) {
        setInputError('Invalid email address');
        return;
      }

      if (value.includes(trimmed)) {
        setInputError('Email already added');
        return;
      }

      onChange([...value, trimmed]);
      setInputValue('');
      setInputError(null);
    },
    [value, onChange]
  );

  const removeEmail = useCallback(
    (emailToRemove: string) => {
      onChange(value.filter((email) => email !== emailToRemove));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inputValue.trim()) {
          addEmail(inputValue);
        }
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        removeEmail(value[value.length - 1]);
      }
    },
    [inputValue, value, addEmail, removeEmail]
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
    setInputError(null);
  }, [inputValue, addEmail]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      const emails = pastedText
        .split(/[,\s]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const validEmails: string[] = [];
      const invalidEmails: string[] = [];

      emails.forEach((email) => {
        if (isValidEmail(email) && !value.includes(email.toLowerCase())) {
          validEmails.push(email.toLowerCase());
        } else if (!isValidEmail(email)) {
          invalidEmails.push(email);
        }
      });

      if (validEmails.length > 0) {
        onChange([...value, ...validEmails]);
        setInputValue('');
      }

      if (invalidEmails.length > 0) {
        setInputError(`Invalid email(s): ${invalidEmails.join(', ')}`);
      } else {
        setInputError(null);
      }
    },
    [value, onChange]
  );

  const displayError = error || inputError;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div
        className={`flex flex-wrap items-center gap-2 min-h-[42px] rounded-md border ${
          displayError ? 'border-red-300' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50' : 'bg-white'} px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500`}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-sm text-blue-700"
          >
            <span>{email}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);
            setInputError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        />
      </div>
      {displayError && (
        <p className="text-xs text-red-500">{displayError}</p>
      )}
    </div>
  );
}
