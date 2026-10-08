export const metadata = {
  title: "Privacy",
  description:
    "Shiftless's privacy policy. The calculator runs entirely in your browser and we do not collect your inputs.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy</h1>
      <p className="mt-2 text-slate-500">Last updated: 29 September 2026</p>

      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">
          The short version: the calculator does not send your inputs anywhere.
        </p>
        <p className="mt-1.5 text-sm text-emerald-800">
          Every number you enter is computed in your own browser. There is no
          account, no login, and no request to our servers carrying your ticket
          volume or your costs.
        </p>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">What we collect</h2>
      <ul className="mt-3 space-y-2 text-slate-700">
        <li>• <b>Nothing from the calculator.</b> Inputs stay on your device.</li>
        <li>• <b>If you buy the report:</b> the email you enter, the product and
          price, an order reference, and the calculator figures you had entered
          at the time. We need these to deliver the purchase and to answer you.
          The figures are in the report link itself, so we do not keep a separate
          copy of them.</li>
        <li>• <b>If you leave your email without buying:</b> it and a timestamp,
          so we can follow up. Unsubscribe and it is deleted.</li>
        <li>• <b>Standard server logs</b> — IP address, user agent, requested URL, timestamp — retained by our hosting provider for security and debugging.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Cookies and analytics</h2>
      <p className="mt-3 text-slate-700">
        We set no cookies — no advertising, no tracking, no analytics cookies, no
        session identifiers, and nothing stored in your browser. We do not run
        third-party ad pixels, session recorders, fingerprinting scripts, or
        third-party analytics services such as Google Analytics.
      </p>
      <p className="mt-3 text-slate-700">
        We do collect a small number of <b>first-party, cookleless events</b> — for
        example, that the calculator was used, and the ticket volume and handle
        time that produced a result. Two properties are enforced in code, not just
        promised here: string values are rejected so an email address or any other
        free text cannot be attached to an event, and the visitor field is a
        salted hash bucket that changes daily, so we count roughly-unique visitors
        without storing anything that could identify you.
      </p>
      <p className="mt-3 text-slate-700">
        If you submit your email through the calculator we keep it, with a
        timestamp, so we can follow up. We do not send automated email, there is
        no mailing list, and nothing is used for advertising. We do not sell, rent
        or share it. Every message we send is a reply to something you asked us
        for, and any of them can be stopped by replying to one.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Embedded calculator</h2>
      <p className="mt-3 text-slate-700">
        <span className="font-mono text-sm">/embed</span> is designed to be placed
        inside someone else&apos;s proposal or document. It sets no cookies, captures
        no email, and stores no identifying data. Its attribution link to this site
        is permanent and cannot be removed from the embed.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Who we are</h2>
      <p className="mt-3 text-slate-700">
        Shiftless is published by Shanghai Bingdashan Intelligent Technology
        Co., Ltd. (上海丙大山智能科技有限公司), Shanghai, China. We store data
        in China where our infrastructure is located.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Your rights</h2>
      <p className="mt-3 text-slate-700">
        Because we hold no cookie or device identifier, there is generally no
        profile to export or delete. If you gave us an email through the
        calculator, we can delete that record on request. Contact us and we will
        respond.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Contact</h2>
      <p className="mt-3 text-slate-700">
        Email <a className="underline" href="mailto:privacy@shiftless.app">privacy@shiftless.app</a>.
      </p>
    </div>
  );
}
