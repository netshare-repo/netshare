import { useMemo } from "react";
import { Activity, RefreshCw } from "lucide-react";
import "./RegionAvailabilityPanel.css";

const formatMetric = (value, suffix = "") =>
  Number.isFinite(value) ? `${value}${suffix}` : "Not measured";

function RegionAvailabilityPanel({
  availability,
  loading,
  refreshing,
  error,
  lastUpdated,
  stale,
  selectedRegion,
  compact = false,
  marquee = false,
}) {
  const displayedRegions = useMemo(() => {
    if (!selectedRegion) return availability;
    return availability.filter(
      (region) => region.region.toLowerCase() === selectedRegion.toLowerCase()
    );
  }, [availability, selectedRegion]);

  const updatedLabel = lastUpdated
    ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
    : "Waiting for first update";
  const shouldMarquee = marquee && displayedRegions.length > 1;

  const renderRegionCard = (region, duplicate = false) => (
    <article className="region-availability-card" key={`${region.region}-${duplicate ? "copy" : "main"}`}>
      <div className="region-availability-card-heading">
        <h3>{region.region}</h3>
        <span className={`region-state ${region.available ? "online" : "offline"}`}>
          {region.available ? "Available" : "Unavailable"}
        </span>
      </div>
      <div className="region-metrics">
        <div><strong>{region.eligibleNodes ?? 0}</strong><span>Eligible nodes</span></div>
        <div><strong>{region.availableSlots ?? 0}</strong><span>Open slots</span></div>
        <div><strong>{formatMetric(region.averageLatencyMs, " ms")}</strong><span>Average latency</span></div>
        <div><strong>{formatMetric(region.averageReliability, "%")}</strong><span>Average reliability</span></div>
      </div>
    </article>
  );

  return (
    <section className={`region-availability ${compact ? "compact" : ""}`} aria-labelledby="availability-title">
      <div className="region-availability-header">
        <div>
          <div className="region-availability-title-row">
            {compact ? <Activity size={18} /> : <Activity size={22} />}
            <h2 id="availability-title">{compact ? "Regional capacity" : "Live Network Availability"}</h2>
          </div>
          {!compact && <p>Current eligible network capacity by region.</p>}
        </div>
        <div className="region-availability-updated" aria-live="polite">
          {refreshing && <RefreshCw size={14} className="availability-spinner" />}
          <span>{updatedLabel}</span>
        </div>
      </div>

      {error && (
        <div className="availability-message warning" role="status">
          {availability.length ? `${error} Showing the last successful snapshot. Reconnecting automatically.` : `${error} Reconnecting automatically.`}
        </div>
      )}
      {stale && availability.length > 0 && (
        <div className="availability-message warning" role="status">
          This availability snapshot is stale. Waiting for a fresh response.
        </div>
      )}
      {loading && availability.length === 0 && (
        <div className="availability-message" role="status">Loading regional availability…</div>
      )}
      {!loading && !error && availability.length === 0 && (
        <div className="availability-message" role="status">No regional availability data was returned.</div>
      )}

      {displayedRegions.length > 0 && (
        <div
          className={`region-availability-grid${shouldMarquee ? " is-marquee" : ""}`}
          tabIndex={shouldMarquee ? 0 : undefined}
          aria-label={shouldMarquee ? "Regional availability cards. Focus or hover to pause." : undefined}
        >
          {shouldMarquee ? (
            <div className="region-availability-track">
              <div className="region-availability-group">
                {displayedRegions.map((region) => renderRegionCard(region))}
              </div>
              <div className="region-availability-group" aria-hidden="true">
                {displayedRegions.map((region) => renderRegionCard(region, true))}
              </div>
            </div>
          ) : displayedRegions.map((region) => renderRegionCard(region))}
        </div>
      )}

      {selectedRegion && displayedRegions.length === 0 && !loading && (
        <div className="availability-message" role="status">
          Availability for {selectedRegion} is not included in the latest response.
        </div>
      )}
      {!compact && <p className="availability-footnote">Node identities and IP addresses are private. Allocation and pricing remain controlled by the platform.</p>}
    </section>
  );
}

export default RegionAvailabilityPanel;
