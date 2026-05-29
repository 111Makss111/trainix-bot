type SelectOption<Value extends string> = {
  label: string;
  value: Value;
};

type SelectInputProps<Value extends string> = {
  value: Value;
  options: Array<SelectOption<Value>>;
  onChange: (value: Value) => void;
};

export function SelectInput<Value extends string>({
  value,
  options,
  onChange,
}: SelectInputProps<Value>) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.currentTarget.value as Value)}
      className="mt-2 h-11 w-full rounded-[1rem] border border-white/10 bg-[#11131c] px-3 text-sm text-white outline-none transition focus:border-white/24 focus:bg-[#151723]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
