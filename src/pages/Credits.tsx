import { Link } from "react-router-dom";
import { IMAGE_REGISTRY, type ImageCredit } from "../data/images";
import styles from "./Roadmap.module.css";
import own from "./Credits.module.css";

const rows = (reg: Readonly<Record<string, ImageCredit>>) => Object.entries(reg).sort(([a], [b]) => a.localeCompare(b));

/** Image and data credits (AC-38, gate step 4). Lists exactly what is installed; never more. */
export function Credits({ registry = IMAGE_REGISTRY }: { registry?: Readonly<Record<string, ImageCredit>> }) {
  const list = rows(registry);
  return (
    <div className={`container ${styles.page} ${own.page}`}>
      <h1>Credits</h1>
      <p className={styles.lead}>Everything on NIVORA’s listings is fictional demonstration data. Here is what is borrowed, and from whom.</p>

      <section aria-labelledby="cr-photos">
        <h2 id="cr-photos">Photographs</h2>
        {list.length === 0 ? (
          <p data-testid="no-images">No licensed photographs are installed yet, so neutral placeholders are shown. Nothing is hot-linked or scraped.</p>
        ) : (
          <>
            <p>
              Illustrative photos, not pictures of any specific property. Used under the{" "}
              <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">Pexels License</a>; stored locally and shown unmodified unless noted.
            </p>
            <ul data-testid="photo-credits" className={own.list}>
              {list.map(([id, c]) => (
                <li key={id}>
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.alt}</a>
                  {c.photographer && (
                    <>
                      {" "}by{" "}
                      {c.photographerUrl ? <a href={c.photographerUrl} target="_blank" rel="noopener noreferrer">{c.photographer}</a> : c.photographer}
                    </>
                  )}{" "}
                  on Pexels · {c.licence.name} · acquired {c.acquiredOn} · {c.modifications} · used by {c.usedBy.join(", ")}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="cr-maps">
        <h2 id="cr-maps">Maps and places</h2>
        <ul className={own.list}>
          <li>
            Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL), shown with OpenStreetMap standard tiles under the{" "}
            <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noopener noreferrer">tile usage policy</a> (light use).
          </li>
          <li>Place search uses OpenStreetMap’s Nominatim, only when you press Search.</li>
          <li>Map library: Leaflet (BSD-2-Clause).</li>
          <li>Vivekananda Global University (VGU) is used only as a location reference for a test destination. NIVORA has no affiliation with or endorsement from it. Its position is approximate.</li>
          <li>Homes on the map are simulated positions of fictional listings.</li>
        </ul>
      </section>

      <section aria-labelledby="cr-other">
        <h2 id="cr-other">Typeface and icons</h2>
        <p>Inter (SIL Open Font License), bundled locally. Icons from Lucide (ISC).</p>
      </section>

      <p><Link to="/">Back to Welcome</Link></p>
    </div>
  );
}
