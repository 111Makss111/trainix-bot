type TextInputProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function TextInput({ value, placeholder, onChange }: TextInputProps) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="mt-2 h-11 w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/24 focus:bg-white/[0.06]"
    />
  );
}
