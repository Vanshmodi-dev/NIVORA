import {useState} from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Building2, ClipboardList, Plus } from "lucide-react";
import { ListingWizard } from "../../components/owner/ListingWizard";
import { TrustBreakdown } from "../../components/property/TrustBreakdown";
import { VerificationIndicator } from "../../components/property/VerificationIndicator";
import { Badge } from "../../components/ui/Badge";
import { Button, buttonClassName } from "../../components/ui/Button";
import { Chip, ChipGroup } from "../../components/ui/Chip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { AppImage } from "../../components/ui/AppImage";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { useToast } from "../../components/ui/Toast";
import { resolveImage } from "../../data/images";
import { formatDate, formatRupees } from "../../domain/format";
import {
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
  LOCALITY_LABEL,
  PROPERTY_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  VERIFICATION_CATEGORY_LABEL,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_TONE,
} from "../../domain/labels";
import {
  countRequestsByProperty,
  selectAttention,
  selectOwnerProperties,
  selectOwnerRequests,
  selectOwnerStats,
  selectRecentActivity,
} from "../../domain/ownerMutations";
import { selectLifecycleStats } from "../../domain/lifecycle";
import { getAvailability } from "../../domain/search";
import { DEMO_OWNER_ID, type Property } from "../../domain/types";
import { getEffectiveVerification } from "../../domain/verification";
import { validateProfile } from "../../domain/validators";
import { appStore, useAppStore } from "../../store/store";
import { ResetDemoDialog } from "../../app/AboutDialog";
import { PERSISTENCE_STATEMENT } from "../../domain/copy";
import { NotFound } from "../Placeholders";
import styles from "./owner.module.css";
import { useNow } from "../../store/useNow";


/* ------------------------------------------------------------------ O-01 */

/** O-01 Demo access: no signup, no OTP. Shown on the first Owner visit, then skipped. */
export function OwnerEntry() {
  const seen = useAppStore((s) => s.ui.ownerIntroSeen);
  const navigate = useNavigate();
  if (seen) return <Navigate to="/owner/dashboard" replace />;
  return (
    <div className={`container ${styles.entry}`}>
      <section className={styles.entryCard} aria-labelledby="entry-title">
        <span className={styles.entryIcon} aria-hidden="true"><Building2 size={28} /></span>
        <h1 id="entry-title">You&apos;re entering the Owner view as the NIVORA demo owner.</h1>
        <p>No account is created and nothing needs a password or code. Sample properties are already loaded, so you can explore straight away. Anything you change stays in this browser.</p>
        <Button
          onClick={() => {
            appStore.getState().setOwnerIntroSeen();
            navigate("/owner/dashboard");
          }}
        >
          Enter dashboard
        </Button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ O-02 */

function Stat({ to, value, label }: { to: string; value: number; label: string }) {
  return (
    <Link to={to} className={styles.stat}>
      <span className={styles.statNum}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </Link>
  );
}

export function OwnerDashboard() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const stats = selectOwnerStats(data, DEMO_OWNER_ID, now);
  const life = selectLifecycleStats(data, DEMO_OWNER_ID, now);
  const attention = selectAttention(data, DEMO_OWNER_ID, now);
  const activity = selectRecentActivity(data, DEMO_OWNER_ID);
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Overview</h1>
        <Link to="/owner/properties/new" className={buttonClassName("primary")}>
          <Plus size={18} aria-hidden="true" /> Add property
        </Link>
      </div>
      <p className={styles.muted}>Figures are derived from this prototype&apos;s demo data.</p>
      <div className={styles.stats}>
        <Stat to="/owner/properties" value={stats.total} label="Total properties" />
        <Stat to="/owner/properties?status=published" value={stats.active} label="Active listings" />
        <Stat to="/owner/verification" value={stats.pendingVerificationTasks} label="Pending verification tasks" />
        <Stat to="/owner/requests" value={stats.newRequests} label="New Requests" />
        <Stat to="/owner/requests" value={stats.scheduledVisits} label="Scheduled visits" />
        <Link to="/owner/rent" className={styles.stat}>
          <span className={styles.statNum}>{formatRupees(life.rent.paid)}</span>
          <span className={styles.statLabel}>Rent recorded as paid (demo){life.rentMonth ? `, ${life.rentMonth}` : ""} · {life.rent.overdueCount} overdue</span>
        </Link>
        <Stat to="/owner/maintenance" value={life.openMaintenance} label="Open maintenance requests" />
      </div>
      <div className={styles.cols}>
        <section className={styles.card} aria-labelledby="attn">
          <h2 id="attn">Needs your attention</h2>
          {attention.length === 0 ? (
            <p className={styles.muted}>Nothing needs attention right now.</p>
          ) : (
            <ul className={styles.plain}>
              {attention.map((a) => (
                <li key={a.key}>
                  <Link to={a.to}>{a.text}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.card} aria-labelledby="act">
          <h2 id="act">Recent activity</h2>
          {activity.length === 0 ? (
            <p className={styles.muted}>No activity yet.</p>
          ) : (
            <ul className={styles.plain}>
              {activity.map((a) => (
                <li key={a.key}>
                  <span>{a.text}</span> <span className={styles.when}>{formatDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ O-03 */

type StatusFilter = "all" | "published" | "unavailable" | "pending_review" | "draft";
type SortKey = "updated" | "rent_asc" | "rent_desc" | "title";

const SORTS: Record<SortKey, string> = { updated: "Recently updated", rent_asc: "Rent: low to high", rent_desc: "Rent: high to low", title: "Title" };

export function MyProperties() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get("status");
  const status: StatusFilter = (["published", "unavailable", "pending_review", "draft"] as const).includes(rawStatus as never) ? (rawStatus as StatusFilter) : "all";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [pendingOff, setPendingOff] = useState<Property | null>(null);

  const all = selectOwnerProperties(data, DEMO_OWNER_ID);
  const list = all
    .filter((p) => status === "all" || p.listingStatus === status)
    .filter((p) => !q.trim() || `${p.title} ${LOCALITY_LABEL[p.locality]}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort === "rent_asc" ? a.rent - b.rent : sort === "rent_desc" ? b.rent - a.rent : sort === "title" ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)));

  const setStatusFilter = (s: StatusFilter) => setParams(s === "all" ? {} : { status: s }, { replace: true });

  const toggle = (p: Property, to: "published" | "unavailable") => {
    const r = appStore.getState().setListingStatus(p.id, to);
    if (r.ok) toast({ tone: "success", title: to === "unavailable" ? `${p.title} marked unavailable` : `${p.title} is available again`, description: "Tenants see the change straight away (demo)." });
    else toast({ tone: "error", title: "Couldn't change availability", description: r.message });
  };

  if (all.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState icon={<Building2 size={26} />} title="You haven't listed a home yet." description="Add a demo property and it appears in Tenant search straight away." action={<Link to="/owner/properties/new" className={buttonClassName("primary")}>Add your first demo property</Link>} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>My Properties <span className={styles.count}>({all.length})</span></h1>
        <Link to="/owner/properties/new" className={buttonClassName("primary")}><Plus size={18} aria-hidden="true" /> Add property</Link>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="visually-hidden">Search my properties</span>
          <input type="search" placeholder="Search title or locality" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className={styles.sort}>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
          </select>
        </label>
      </div>
      <ChipGroup label="Filter by listing status">
        {([["all", "All"], ["published", "Published"], ["unavailable", "Unavailable"], ["pending_review", "Pending review"], ["draft", "Draft"]] as const).map(([id, label]) => (
          <Chip key={id} selected={status === id} onClick={() => setStatusFilter(id)}>{label}</Chip>
        ))}
      </ChipGroup>
      <p aria-live="polite" className={styles.muted} data-testid="owner-count">{list.length} {list.length === 1 ? "property" : "properties"}</p>

      {list.length === 0 ? (
        <div className={styles.card}>
          <p>No properties match this filter.</p>
          <Button variant="secondary" size="sm" onClick={() => { setQ(""); setStatusFilter("all"); }}>Clear filter</Button>
        </div>
      ) : (
        <ul className={styles.propList}>
          {list.map((p) => {
            const eff = getEffectiveVerification(p, data.verificationItems, now);
            const counts = countRequestsByProperty(data, p.id);
            const photo = p.photoIds[0] ? resolveImage(p.photoIds[0]) : null;
            const availability = p.listingStatus === "published" || p.listingStatus === "unavailable" ? getAvailability(p, now).label : "Not visible to tenants";
            return (
              <li key={p.id} className={styles.prop} data-testid="owner-property" data-property-id={p.id}>
                <div className={styles.thumb}><AppImage src={photo?.src} alt="" focus={photo?.focus} badge compact /></div>
                <div className={styles.propMain}>
                  <h2><Link to={`/owner/properties/${p.id}`}>{p.title}</Link></h2>
                  <p className={styles.muted}>{PROPERTY_TYPE_LABEL[p.type]} · {LOCALITY_LABEL[p.locality]} · {formatRupees(p.rent)} / month {p.source === "fixture" && <span className={styles.sample}>Sample</span>}</p>
                  <div className={styles.badges}>
                    <Badge tone={LISTING_STATUS_TONE[p.listingStatus]}>{LISTING_STATUS_LABEL[p.listingStatus]}</Badge>
                    <span className={styles.muted}>{availability}</span>
                  </div>
                  <VerificationIndicator effective={eff} />
                  <p className={styles.muted}>Requests: {counts.open} open · {counts.total} total</p>
                </div>
                <div className={styles.propActions}>
                  <Link to={`/owner/properties/${p.id}`} className={buttonClassName("secondary", "sm")}>View details</Link>
                  <Link to={`/owner/properties/${p.id}/edit`} className={buttonClassName("secondary", "sm")}>Edit listing</Link>
                  {p.listingStatus === "published" && <Button variant="destructive" size="sm" onClick={() => setPendingOff(p)}>Mark unavailable</Button>}
                  {p.listingStatus === "unavailable" && <Button variant="secondary" size="sm" onClick={() => toggle(p, "published")}>Mark available</Button>}
                  <Link to={`/owner/verification?property=${p.id}`} className={buttonClassName("tertiary", "sm")}>Review verification</Link>
                  <Link to={`/owner/requests?property=${p.id}`} className={buttonClassName("tertiary", "sm")}>View enquiries</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog open={pendingOff !== null} title="Mark this home unavailable?" confirmLabel="Mark unavailable" destructive onCancel={() => setPendingOff(null)} onConfirm={() => { if (pendingOff) toggle(pendingOff, "unavailable"); setPendingOff(null); }}>
        <p>{pendingOff?.title} will disappear from Tenant search. Existing visit requests are kept and stay visible.</p>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ O-04 / O-06 */

export function AddProperty() {
  return <ListingWizard mode={{ kind: "new" }} />;
}

function useOwnedProperty(): Property | null {
  const { propertyId = "" } = useParams();
  return useAppStore((s) => s.data.properties.find((p) => p.id === propertyId && p.ownerId === DEMO_OWNER_ID) ?? null);
}

export function EditProperty() {
  const p = useOwnedProperty();
  if (!p) return <NotFound persona="owner" />;
  return <ListingWizard key={p.id} mode={{ kind: "edit", property: p }} />;
}

/* ------------------------------------------------------------------ O-05 */

type Tab = "overview" | "requests" | "verification" | "activity";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "requests", label: "Requests" },
  { id: "verification", label: "Verification" },
  { id: "activity", label: "Activity" },
];

export function PropertyManage() {
  const p = useOwnedProperty();
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [confirmOff, setConfirmOff] = useState(false);
  const location = useLocation();
  const [published, setPublished] = useState(() => (location.state as { published?: boolean } | null)?.published === true);
  if (!p) return <NotFound persona="owner" />;

  const tab: Tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview") as Tab;
  const eff = getEffectiveVerification(p, data.verificationItems, now);
  const requests = selectOwnerRequests(data, DEMO_OWNER_ID).filter((r) => r.propertyId === p.id);
  const tenantVisible = p.listingStatus === "published" || p.listingStatus === "unavailable";

  const toggle = (to: "published" | "unavailable") => {
    const r = appStore.getState().setListingStatus(p.id, to);
    if (r.ok) toast({ tone: "success", title: to === "unavailable" ? "Marked unavailable" : "Marked available again", description: "Tenants see the change straight away (demo). Existing requests are kept." });
    else toast({ tone: "error", title: "Couldn't change availability", description: r.message });
  };
  const preview = () => {
    appStore.getState().setPersona("tenant");
    navigate(`/tenant/property/${p.id}`);
  };

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link to="/owner/properties">My Properties</Link> › <span aria-current="page">{p.title}</span>
      </nav>
      {published && (
        <div className={styles.success} role="status">
          <p><strong>Demo listing published.</strong> It is now visible to Tenants in this prototype.</p>
          <div className={styles.rowBtns}>
            <Button size="sm" onClick={preview}>Preview as Tenant</Button>
            <Link to="/owner/properties" className={buttonClassName("secondary", "sm")}>View in My Properties</Link>
            <Link to="/owner/properties/new" className={buttonClassName("secondary", "sm")} onClick={() => setPublished(false)}>Add another</Link>
            <Button size="sm" variant="tertiary" onClick={() => setPublished(false)}>Dismiss</Button>
          </div>
        </div>
      )}
      <header className={styles.head}>
        <div>
          <h1>{p.title}</h1>
          <p className={styles.muted}>{p.displayCode} · {PROPERTY_TYPE_LABEL[p.type]} · {LOCALITY_LABEL[p.locality]} · {formatRupees(p.rent)} / month</p>
          <div className={styles.badges}>
            <Badge tone={LISTING_STATUS_TONE[p.listingStatus]}>{LISTING_STATUS_LABEL[p.listingStatus]}</Badge>
            <span className={styles.demoPill}>Demo listing</span>
          </div>
        </div>
        <div className={styles.rowBtns}>
          <Link to={`/owner/properties/${p.id}/edit`} className={buttonClassName("secondary")}>Edit listing</Link>
          {p.listingStatus === "published" && <Button variant="destructive" onClick={() => setConfirmOff(true)}>Mark unavailable</Button>}
          {p.listingStatus === "unavailable" && <Button variant="secondary" onClick={() => toggle("published")}>Mark available</Button>}
          <Button variant="secondary" onClick={preview} disabled={!tenantVisible} aria-describedby={tenantVisible ? undefined : "preview-note"}>Preview as Tenant</Button>
        </div>
      </header>
      {!tenantVisible && <p id="preview-note" className={styles.muted}>Tenants can&apos;t see a {LISTING_STATUS_LABEL[p.listingStatus].toLowerCase()} listing, so there is nothing to preview.</p>}

      <div role="tablist" aria-label="Property sections" className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`} onClick={() => setParams(t.id === "overview" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={styles.panel}>
        {tab === "overview" && (
          <dl className={styles.dl}>
            <div><dt>Availability</dt><dd>{tenantVisible ? getAvailability(p, now).label : "Not visible to tenants"}</dd></div>
            <div><dt>Deposit</dt><dd>{formatRupees(p.deposit)}</dd></div>
            <div><dt>Maintenance</dt><dd>{p.maintenanceIncluded || p.maintenanceCharge === null ? "Included in rent" : `${formatRupees(p.maintenanceCharge)} / month`}</dd></div>
            <div><dt>Available from</dt><dd>{formatDate(p.availableFrom)}</dd></div>
            <div><dt>Rooms / bathrooms</dt><dd>{p.bedrooms} / {p.bathrooms}</dd></div>
            <div><dt>Address area</dt><dd>{p.addressArea}</dd></div>
            <div><dt>Photos</dt><dd>{p.photoIds.length} selected</dd></div>
            <div><dt>Requests</dt><dd>{requests.length} total, {requests.filter((r) => r.status === "pending").length} Pending</dd></div>
            <div className={styles.wide}><dt>Description</dt><dd>{p.description}</dd></div>
          </dl>
        )}
        {tab === "requests" && (
          requests.length === 0 ? <p className={styles.muted}>No visit requests for this home yet.</p> : (
            <>
              <ul className={styles.plain}>
                {requests.map((r) => (
                  <li key={r.id}><strong>{r.displayCode}</strong> · {r.tenantNameEntered} · <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge></li>
                ))}
              </ul>
              <Link to={`/owner/requests?property=${p.id}`} className={buttonClassName("secondary", "sm")}>Manage in Enquiries &amp; Visits</Link>
            </>
          )
        )}
        {tab === "verification" && (
          <>
            <TrustBreakdown effective={eff} />
            <Link to={`/owner/verification?property=${p.id}`} className={buttonClassName("secondary", "sm")}>Open in Verification Center</Link>
          </>
        )}
        {tab === "activity" && (
          <ol className={styles.plain} aria-label="Activity log">
            {p.history.map((h, i) => (
              <li key={`${h.at}-${i}`}><span>{h.summary}</span> <span className={styles.when}>{formatDate(h.at)}</span></li>
            ))}
          </ol>
        )}
      </div>

      <ConfirmDialog open={confirmOff} title="Mark this home unavailable?" confirmLabel="Mark unavailable" destructive onCancel={() => setConfirmOff(false)} onConfirm={() => { setConfirmOff(false); toggle("unavailable"); }}>
        <p>This home will disappear from Tenant search. Existing visit requests are kept and stay visible.</p>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ O-10 */

export function VerificationCenter() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const focus = params.get("property");
  const props = selectOwnerProperties(data, DEMO_OWNER_ID);

  const reconfirm = (p: Property) => {
    const r = appStore.getState().reconfirmAvailability(p.id);
    if (r.ok) toast({ tone: "success", title: "Availability re-confirmed", description: "Recorded as owner-declared (demo). NIVORA has not checked it." });
    else toast({ tone: "error", title: "Couldn't re-confirm", description: r.message });
  };
  const attach = (p: Property, c: "identity" | "authority") => {
    const r = appStore.getState().attachSampleDocument(p.id, c);
    if (r.ok) toast({ tone: "success", title: `${VERIFICATION_CATEGORY_LABEL[c]}: sample document attached (demo)`, description: "Now Pending review. No document was uploaded or checked." });
    else toast({ tone: "error", title: "Couldn't attach the sample document", description: r.message });
  };

  return (
    <div className={styles.page}>
      <h1>Verification Center</h1>
      <section className={styles.card} aria-labelledby="vc-explain">
        <h2 id="vc-explain">Four separate checks</h2>
        <p>Each check answers a different question: <strong>identity is not ownership</strong>, and <strong>accuracy is not availability</strong>. All statuses here are demo data. No real document is collected and nothing is verified by NIVORA or anyone else.</p>
        <Link to="/trust">How trust works on NIVORA</Link>
      </section>
      {props.length === 0 ? (
        <EmptyState icon={<ClipboardList size={26} />} title="No properties to review" description="Add a demo property to see its checks here." action={<Link to="/owner/properties/new" className={buttonClassName("primary")}>Add property</Link>} />
      ) : (
        props.map((p) => {
          const eff = getEffectiveVerification(p, data.verificationItems, now);
          return (
            <section key={p.id} className={`${styles.card} ${focus === p.id ? styles.focused : ""}`} aria-labelledby={`vc-${p.id}`} data-testid="vc-property" data-property-id={p.id}>
              <div className={styles.head}>
                <h2 id={`vc-${p.id}`}><Link to={`/owner/properties/${p.id}`}>{p.title}</Link></h2>
                <Badge tone={LISTING_STATUS_TONE[p.listingStatus]}>{LISTING_STATUS_LABEL[p.listingStatus]}</Badge>
              </div>
              <ul className={styles.vrows}>
                {eff.map((e) => (
                  <li key={e.category} data-category={e.category} data-status={e.status}>
                    <div>
                      <strong>{VERIFICATION_CATEGORY_LABEL[e.category]}</strong>
                      <Badge tone={VERIFICATION_STATUS_TONE[e.status]}>{VERIFICATION_STATUS_LABEL[e.status]}</Badge>
                    </div>
                    <p className={styles.muted}>
                      {e.item.source === "owner_declared" ? "Owner declared" : e.item.source === "simulated_review" ? "Simulated by presenter (demo)" : "Demo fixture"}
                      {e.item.checkedAt ? ` · ${formatDate(e.item.checkedAt)}` : ""}
                    </p>
                    <p>{nextStep(e.status, e.category, e.stale)}</p>
                    {e.category === "availability" && (e.status === "needs_reverification" || e.status === "verified_demo") && (
                      p.listingStatus === "published" ? <Button size="sm" variant="secondary" onClick={() => reconfirm(p)} aria-label={`Reconfirm availability for ${p.title}`}>Reconfirm availability</Button> : <p className={styles.muted}>Mark the home available before re-confirming.</p>
                    )}
                    {(e.category === "identity" || e.category === "authority") && e.status === "not_checked" && (
                      <Button size="sm" variant="secondary" onClick={() => attach(p, e.category as "identity" | "authority")} aria-label={`Attach sample document (demo) for ${VERIFICATION_CATEGORY_LABEL[e.category]} on ${p.title}`}>Attach sample document (demo)</Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function nextStep(status: string, category: string, stale: boolean): string {
  if (status === "verified_demo") return category === "availability" ? "Confirmed recently (demo data)." : "Marked verified in demo data.";
  if (status === "pending_review") return "Waiting for review. In a real product this is where a reviewer would check your documents.";
  if (status === "not_checked") return "No documents provided yet. In a real product you'd submit proof here.";
  return stale ? "Availability hasn't been confirmed for more than 14 days. Reconfirm to keep your listing fresh." : "This check is out of date and would need to be done again.";
}

/* ------------------------------------------------------------------ O-11 */

export function OwnerSettings() {
  const owner = useAppStore((s) => s.data.owners.find((o) => o.id === DEMO_OWNER_ID));
  const { toast } = useToast();
  const [name, setName] = useState(owner?.displayName ?? "");
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [reset, setReset] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProfile({ name, phone });
    if (!check.ok) return setErrors(check.errors);
    setErrors({});
    const r = appStore.getState().saveOwnerProfile({ name, phone });
    if (r.ok) toast({ tone: "success", title: "Details saved in this browser" });
    else toast({ tone: "error", title: "Couldn't save your details", description: "message" in r ? r.message : undefined });
  };
  return (
    <div className={styles.page}>
      <h1>Profile &amp; settings</h1>
      <section className={styles.card} aria-labelledby="set-profile">
        <h2 id="set-profile">Your details</h2>
        <p className={styles.muted}>You are the <strong>demo owner</strong>. There is no real account. These details are asked for only when you publish, and are never shown to tenants.</p>
        <form className={styles.form} onSubmit={save} noValidate>
          <Field label="Name" error={errors.name}>{(a) => <input {...a} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Phone number" help="Use sample details — this is a demo." error={errors.phone}>{(a) => <input {...a} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <div><Button type="submit">Save details</Button></div>
        </form>
      </section>
      <section className={styles.card} aria-labelledby="set-data">
        <h2 id="set-data">Demo data</h2>
        <p>{PERSISTENCE_STATEMENT}</p>
        <div><Button variant="destructive" onClick={() => setReset(true)}>Reset demo data</Button></div>
      </section>
      <ResetDemoDialog open={reset} onClose={() => setReset(false)} />
    </div>
  );
}
