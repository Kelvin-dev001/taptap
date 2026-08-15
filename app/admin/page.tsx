import MintForm from "./mint-form";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-1 text-page-title text-foreground">Card provisioning</h1>
      <p className="mb-6 text-body-sm text-muted">
        Mint a batch of blank tag tokens, then encode the URLs onto NFC cards (or
        print them as QR). Customers claim a card on first tap.
      </p>
      <MintForm />
    </main>
  );
}
