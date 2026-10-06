import React, { useState } from 'react';
import { PasswordInput } from '../../../components/PasswordInput';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled: boolean;
}

export function NewAccountPasswordField({ value, onChange, onGenerate, disabled }: Props) {
  const [copyStatus, setCopyStatus] = useState('');
  return (
    <div className="space-y-1.5">
      <label htmlFor="new-account-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Initial Password</label>
      <PasswordInput
        id="new-account-password" required autoComplete="new-password" minLength={16} maxLength={72}
        value={value} disabled={disabled} aria-describedby="new-account-password-help"
        onChange={(event) => { onChange(event.target.value); setCopyStatus(''); }}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 transition-colors text-sm"
      />
      <p id="new-account-password-help" className="text-xs text-slate-500 dark:text-slate-400">
        Use the generated password or enter your own (at least 16 characters). Copy it before creating the account.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" disabled={disabled} className="font-semibold text-[#0063a9] hover:underline dark:text-blue-300 disabled:opacity-50"
          onClick={() => { onGenerate(); setCopyStatus(''); }}>Generate Strong Password</button>
        <button type="button" disabled={disabled || !value} className="font-semibold text-[#0063a9] hover:underline dark:text-blue-300 disabled:opacity-50"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopyStatus('Password copied.'); }
            catch { setCopyStatus('Unable to copy. Reveal the password and copy it manually.'); }
          }}>Copy Password</button>
        <span role="status" className="text-slate-500 dark:text-slate-400">{copyStatus}</span>
      </div>
    </div>
  );
}
