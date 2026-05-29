type TextAreaInputProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function TextAreaInput({
  value,
  placeholder,
  onChange,
}: TextAreaInputProps) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="mt-2 min-h-28 w-full resize-y rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/26 focus:border-white/24 focus:bg-white/[0.06]"
    />
  );
}
