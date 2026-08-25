import React, { useState, useEffect } from 'react';

export interface NumericInputProps {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: string | number;
  allowDecimal?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Universal Sanitized Numeric Input Component
 * Solves the "stuck-zero" problem by decoupling the UI string representation from calculation state.
 *
 * BEHAVIOR:
 * - Empty field displays as empty string "" (state: null)
 * - User can backspace, select all and delete without forcing 0
 * - User typing "0" is accepted as legitimate 0
 * - Rejects non-numeric characters automatically
 * - Safe for currency, odometer, age, percentages, and floating-point values
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter value...',
  className = '',
  min,
  max,
  allowDecimal = true,
  required = false,
  id,
  name,
  disabled = false,
  autoFocus = false
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    return String(value);
  });

  // Sync external state changes
  useEffect(() => {
    const currentNum = displayValue.trim() === '' ? null : Number(displayValue);
    if (value !== currentNum) {
      setDisplayValue(value === null || value === undefined ? '' : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // 1. Allow complete clearance
    if (raw === '') {
      setDisplayValue('');
      onChange(null);
      return;
    }

    // 2. Reject invalid non-numeric inputs
    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!pattern.test(raw)) {
      return;
    }

    setDisplayValue(raw);

    // 3. Trailing dot or standalone sign
    if (raw === '-' || raw === '.' || raw.endsWith('.')) {
      onChange(null);
      return;
    }

    const num = Number(raw);
    if (!isNaN(num)) {
      onChange(num);
    } else {
      onChange(null);
    }
  };

  const handleBlur = () => {
    if (displayValue.trim() === '') {
      onChange(null);
      return;
    }
    const num = Number(displayValue);
    if (!isNaN(num)) {
      if (min !== undefined && num < min) {
        setDisplayValue(String(min));
        onChange(min);
      } else if (max !== undefined && num > max) {
        setDisplayValue(String(max));
        onChange(max);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      id={id}
      name={name}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoFocus={autoFocus}
      required={required}
      autoComplete="off"
    />
  );
};
