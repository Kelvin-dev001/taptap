export const metadata = { title: "Privacy Policy — Hornbill TapTap" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-body-sm text-muted">Last updated: 24 July 2026</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Who we are</h2>
          <p>
            Hornbill TapTap (“we”) is operated by Hornbill Technologies Limited,
            Mombasa, Kenya. We are the data controller for the information
            described here. Contact us at{" "}
            <a href="mailto:info@hornbilltech.co.ke" className="underline">
              info@hornbilltech.co.ke
            </a>{" "}
            or on{" "}
            <a href="tel:+254759293030" className="underline">
              0759 293 030
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Data we collect</h2>
          <p>
            Account data you provide (email, business details); content you add to
            your smart pages; engagement analytics when your pages are tapped or
            scanned (event type, approximate device/OS, coarse country, timestamp);
            leads that visitors voluntarily submit through your pages; and payment
            metadata for subscriptions (we never store card details).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">How we use it</h2>
          <p>
            To provide and improve the service, show you analytics, process
            subscriptions, and support you. Visitor leads are shared only with the
            business whose page collected them.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Legal basis & consent</h2>
          <p>
            We process data under the Kenya Data Protection Act, 2019, on the basis
            of your consent and our legitimate interest in operating the service.
            Visitors submitting a lead form consent to being contacted by that
            business.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Processors we use</h2>
          <p>
            Supabase (database/auth/storage), Vercel (hosting), and Safaricom M-Pesa
            (payments). These providers process data on our behalf under their own
            safeguards.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Retention & your rights</h2>
          <p>
            We keep data for as long as your account is active or as needed to
            provide the service. You may request access to, correction of, or
            deletion of your data by emailing{" "}
            <a href="mailto:info@hornbilltech.co.ke" className="underline">
              info@hornbilltech.co.ke
            </a>
            . You may also lodge a complaint with the Office of the Data
            Protection Commissioner (ODPC), Kenya.
          </p>
        </section>
      </div>
    </main>
  );
}
