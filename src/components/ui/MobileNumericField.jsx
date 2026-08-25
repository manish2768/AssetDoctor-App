/**
 * React Native numeric field — prevents "stuck zero" when clearing inputs.
 * Keeps a display string so "", "0", "1", "1000", "2.5" all work.
 * Presentation only; callers convert to numbers on save.
 */

import React, { useEffect, useState } from 'react';
import { TextInput, Text, View, StyleSheet } from 'react-native';

import { COLORS } from '../../theme/branding';
import { HIT } from '../../theme/tokens';

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} props.value — always a string from parent
 * @param {(next: string) => void} props.onChangeText
 * @param {boolean} [props.allowDecimal]
 * @param {string} [props.placeholder]
 * @param {object} [props.style]
 * @param {object} [props.inputStyle]
 */
export function MobileNumericField({
  label,
  value,
  onChangeText,
  allowDecimal = false,
  placeholder,
  style,
  inputStyle,
  ...rest
}) {
  const [display, setDisplay] = useState(() =>
    value == null || value === undefined ? '' : String(value),
  );

  useEffect(() => {
    const incoming = value == null || value === undefined ? '' : String(value);
    const currentNum = display.trim() === '' ? null : Number(display);
    const incomingNum = incoming.trim() === '' ? null : Number(incoming);
    if (incoming !== display && incomingNum !== currentNum) {
      setDisplay(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent value only
  }, [value]);

  const onChange = (raw) => {
    if (raw === '') {
      setDisplay('');
      onChangeText?.('');
      return;
    }
    const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!pattern.test(raw)) return;
    setDisplay(raw);
    if (raw === '-' || raw === '.' || raw.endsWith('.')) {
      onChangeText?.(raw);
      return;
    }
    onChangeText?.(raw);
  };

  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        value={display}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        style={[styles.input, inputStyle]}
        accessibilityLabel={label || placeholder || 'Numeric input'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: HIT.min,
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    fontSize: 15,
  },
});

export default MobileNumericField;
