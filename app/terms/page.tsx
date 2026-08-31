export const metadata = { title: "Terms of Service — Hornbill TapTap" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-body-sm text-muted">Last updated: 24 July 2026</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="mb-1 text-lg font-semibold">The service</h2>
          <p>
            Hornbill TapTap lets businesses create smart pages reachable via NFC, QR,
            and links, with analytics and lead capture. By using it you agree to
            these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Accounts & acceptable use</h2>
          <p>
            You are responsible for your account and content. Do not use the service
            for unlawful, misleading, or abusive purposes, and respect the platforms
            you link to (for example, do not manipulate reviews in violation of a
            provider’s policies).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Subscriptions & payment</h2>
          <p>
            Paid plans are billed annually via M-Pesa. Prices are shown before
            purchase. Payments are processed by Safaricom; we do not store card or
            M-Pesa PIN data. Subscriptions provide access for the paid period.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Hardware</h2>
          <p>
            NFC cards are sold as-is; a card links to your chosen smart page and can
            be repointed or disabled from your dashboard without re-encoding.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Disclaimer & liability</h2>
          <p>
            The service is provided “as is”. To the extent permitted by law, we are
            not liable for indirect or consequential losses. These terms are governed
            by the laws of Kenya.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Contact</h2>
          <p>
            Questions about these terms:{" "}
            <a href="mailto:info@hornbilltech.co.ke" className="underline">
              info@hornbilltech.co.ke
            </a>
            . Sales enquiries:{" "}
            <a href="mailto:sales@hornbilltech.co.ke" className="underline">
              sales@hornbilltech.co.ke
            </a>
            . Phone:{" "}
            <a href="tel:+254759293030" className="underline">
              0759 293 030
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
