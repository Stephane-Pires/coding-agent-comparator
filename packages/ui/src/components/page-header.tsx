/** How every page starts: its title. */
export function PageHeader({ title }: { title: string }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </header>
  );
}
