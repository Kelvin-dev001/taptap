import MintForm from "./mint-form";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export default function MintPage() {
  return (
    <div className="max-w-lg">
      <PageHeader
        title="Card provisioning"
        description="Mint blank tag tokens, then encode the URLs onto NFC cards. Minted tokens sit in the pool and are drawn automatically when an order is paid."
      />
      {/* ADMIN_TOKEN survives here as a SECOND factor. The staff gate in the
          layout is who you are; this is confirmation for the one action in the
          console that creates permanent public identifiers. */}
      <MintForm />
    </div>
  );
}
