export function PageHero({ title, lead }: { title: string; lead: string }) {
  return (
    <section className="bg-brand-950 text-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-32 sm:px-8 lg:pb-20 lg:pt-40">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{lead}</p>
      </div>
    </section>
  );
}
