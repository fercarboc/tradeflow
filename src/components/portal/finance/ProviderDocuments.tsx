// MP-FIN-5B — Provider Documents tab (replaces placeholder)
// Two vertical blocks: TrabFlow financial documents + provider-emitted references.
import { SimBanner } from './shared'
import FinDocList from './FinDocList'
import ProviderDocRefList from './ProviderDocRefList'

export default function ProviderDocuments({ actorId }: { actorId: string }) {
  return (
    <div className="space-y-6">
      <SimBanner />

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <FinDocList actorId={actorId} />
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <ProviderDocRefList actorId={actorId} />
      </div>
    </div>
  )
}
