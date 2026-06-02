type PlaceholderProps = {
  label: string;
};

export function Placeholder({ label }: PlaceholderProps) {
  return (
    <div
      style={{
        padding: "1rem",
        border: "1px dashed #cbd5e1",
        borderRadius: "0.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {label}
    </div>
  );
}
