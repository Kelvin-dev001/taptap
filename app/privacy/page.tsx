import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/whatsapp-button";

export const metadata = { title: "Privacy Policy — Hornbill TapTap" };

/**
 * Updated for the app (docs/mobile/PLAN.md §9 W13, M6): every processor that
 * touches personal data, where it is stored, how long it is kept, and how to
 * delete an account. Each statement matches what the code does — change one,
 * change the other.
 */
const PROCESSORS: [string, string, string][] = [
  ["Supabase", "Database, sign-in and file storage", "Ireland (EU)"],
  ["Vercel", "Hosts the website and runs its server code", "United States and other regions"],
  ["Resend", "Sends our emails, including lead notifications, which contain the lead's details", "United States"],
  ["Safaricom M-Pesa", "Payments", "Kenya"],
  [
    "Expo, with Google Firebase Cloud Messaging and Apple Push Notification service",
    "Deliver notifications to the TapTap app",
    "United States",
  ],
  ["Sentry", "Crash reports from the TapTap app", "United States"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-body-sm text-muted">Last updated: 12 October 2026</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Who we are</h2>
          <p>
            Hornbill TapTap (“we”) is operated by Hornbill Technologies Limited,
            Mombasa, Kenya. We are the data controller for the information
            described here, on our website and in the TapTap app. Contact us at{" "}
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
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <strong>Your account:</strong> your email address, your password (kept
              only in scrambled form by our sign-in provider), your business details,
              and who in your business has access.
            </li>
            <li>
              <strong>Your pages and cards:</strong> what you add to your profiles,
              including photos and logos you upload, and which cards are linked to
              which profile.
            </li>
            <li>
              <strong>Visitors to your pages:</strong> when someone taps a card, scans
              a QR code, opens a profile or presses a button on it, we record what
              happened and when, the type of device and operating system, the country
              and region, and the site they came from. We do not store their IP
              address or try to identify them.
            </li>
            <li>
              <strong>Leads:</strong> the details a visitor chooses to send through a
              page&apos;s contact form, such as their name, phone number, email,
              company and message.
            </li>
            <li>
              <strong>Payments and orders:</strong> M-Pesa payment references, amounts
              and dates, and the contact and delivery details for card orders. We
              never see your M-Pesa PIN or card details.
            </li>
            <li>
              <strong>The TapTap app:</strong> if you turn on notifications, a
              notification address for your phone, with the app&apos;s version and
              language; and crash reports showing your phone&apos;s model, its
              operating system and what went wrong, with names, email addresses and
              IP addresses removed. The app reads a TapTap card&apos;s identifier by
              NFC only while you set up a card, and opens your photos only when you
              choose a profile photo. It does not use your location, your contacts
              or an advertising ID.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">How we use it</h2>
          <p>
            To run the service: show your pages, link your cards, count taps and
            scans, and pass leads to you. To tell you what matters, by email and in
            the app: new leads, a new card&apos;s first tap, and when a card&apos;s
            term ends — notifications never show a lead&apos;s name or number. To
            process payments and orders and keep tax records. And to support you and
            keep the service secure and working, which includes fixing crashes.
            Visitor leads are shared only with the business whose page collected
            them. We do not sell personal data or use it for advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Legal basis & consent</h2>
          <p>
            We process data under the Kenya Data Protection Act, 2019: to provide the
            service you signed up for, to meet our legal duties (such as keeping tax
            records), on the basis of your consent (such as notifications, which you
            can turn off at any time), and in our legitimate interest in operating
            and securing the service. Visitors submitting a lead form consent to
            being contacted by that business.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Who processes data for us, and where</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {PROCESSORS.map(([name, what, where]) => (
              <li key={name}>
                <strong>{name}</strong> — {what}. {where}.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Most of these providers are outside Kenya, so your data is transferred
            abroad. We use providers that are bound by contract to protect it, and
            give each only what it needs to do its job.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">How long we keep it</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Your account, pages and their analytics: while your account is open.</li>
            <li>Leads: until the business deletes them, or deletes its account.</li>
            <li>
              Payment and order records: five years, as Kenyan tax law requires. If
              you delete your account, your name, phone number and delivery details
              are removed from them.
            </li>
            <li>
              A phone&apos;s notification address: until you sign out of the app on
              that phone, or the app is removed.
            </li>
            <li>Crash reports: up to 90 days.</li>
          </ul>
          <p className="mt-2">
            Deleted data can remain in our database provider&apos;s backups for a
            short time before they expire.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Deleting your account</h2>
          <p>
            In the TapTap app, go to Account → Delete account. On the web, go to{" "}
            <Link href="/account/delete" className="underline">
              taptap.hornbilltech.co.ke/account/delete
            </Link>
            . Or email us from the address on your account. Your profiles, analytics
            and leads are deleted and your cards stop working; payment and order
            records are kept as described above. If others share your business
            account, only you are removed.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Your rights</h2>
          <p>
            You may ask to see, correct or delete your data, or object to how we use
            it, by emailing{" "}
            <a href="mailto:info@hornbilltech.co.ke" className="underline">
              info@hornbilltech.co.ke
            </a>
            . You may also lodge a complaint with the Office of the Data
            Protection Commissioner (ODPC), Kenya.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Changes to this policy</h2>
          <p>
            When we change this policy we update the date at the top, and we tell
            account holders by email about any significant change.
          </p>
        </section>
      </div>
      <WhatsAppButton />
    </main>
  );
}
