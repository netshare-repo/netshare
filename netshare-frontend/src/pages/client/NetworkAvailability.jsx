import ClientLayout from "../../layouts/ClientLayout";
import RegionAvailabilityPanel from "../../components/client/RegionAvailabilityPanel";
import { useRegionAvailability } from "../../hooks/useRegionAvailability";
import "./NetworkAvailability.css";

export default function NetworkAvailability() {
  const availability = useRegionAvailability();

  return (
    <ClientLayout
      pageTitle="Network Availability"
      pageSubtitle="Live regional capacity"
    >
      <main className="ps-network-availability-page">
        <div className="ps-page-header">
          <div>
            <h2 className="ps-page-title">Network Availability</h2>
            <p className="ps-page-subtitle">
              Live node capacity and performance across supported regions.
            </p>
          </div>
        </div>

        <RegionAvailabilityPanel
          availability={availability.regions}
          loading={availability.loading}
          refreshing={availability.refreshing}
          error={availability.error}
          lastUpdated={availability.lastUpdated}
          stale={availability.stale}
          marquee
        />
      </main>
    </ClientLayout>
  );
}
