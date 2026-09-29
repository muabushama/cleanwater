import { Input } from '@/components/ui/input';
import { sanitizePhoneDigits } from '@/lib/phoneDigits';
import type { ComponentProps } from 'react';

type PhoneInputProps = Omit<ComponentProps<'input'>, 'type' | 'maxLength' | 'onChange' | 'value'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function PhoneInput({ value, onValueChange, className, ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      dir="ltr"
      maxLength={11}
      className={className}
      value={sanitizePhoneDigits(value)}
      onChange={(e) => onValueChange(sanitizePhoneDigits(e.target.value))}
    />
  );
}
