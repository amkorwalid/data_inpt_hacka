import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[36px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.36em] text-cyan-200">DentalMentor AI</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          AI-guided dental imaging with an interactive clinical dashboard.
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          Use the dashboard to upload radiographs, explore tooth and polygon highlights on the
          central canvas, and run the audio chatbot with live transcription.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Open dashboard
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-50">
        ⚠️ This tool is a demonstration prototype. It does not replace a consultation with a qualified
        dentist.
      </section>
    </main>
  );
}
