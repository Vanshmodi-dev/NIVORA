import { EntryGate } from "../onboarding/EntryGate";
import { Onboarding } from "../onboarding/Onboarding";
import { Route, Routes } from "react-router-dom";
import { DevStub, NotFound } from "../pages/Placeholders";
import { DashboardLayout } from "../pages/dashboard/DashboardLayout";
import { DashboardOverview } from "../pages/dashboard/DashboardOverview";
import { ProfilePage } from "../pages/dashboard/ProfilePage";
import { RequestsPage } from "../pages/dashboard/RequestsPage";
import { SavedPage } from "../pages/dashboard/SavedPage";
import { AddProperty, EditProperty, MyProperties, OwnerDashboard, OwnerEntry, OwnerSettings, PropertyManage, VerificationCenter } from "../pages/owner/OwnerPages";
import { EnquiriesPage } from "../pages/owner/EnquiriesPage";
import { MaintenanceManagement, RentTracking } from "../pages/owner/LifecyclePages";
import { RentalPage } from "../pages/dashboard/RentalPage";
import { PropertyDetails } from "../pages/PropertyDetails";
import { TenantHome } from "../pages/TenantHome";
import { TenantResults } from "../pages/TenantResults";
import { TrustCenterPage } from "../pages/TrustCenterPage";
import { Roadmap } from "../pages/Roadmap";
import { Credits } from "../pages/Credits";
import { OWNER_STUBS, PUBLIC_STUBS, SHOW_UNBUILT, TENANT_STUBS } from "./nav";
import { PresenterPanelRoute } from "./presenterSlots";
import { OwnerShell, PersonaShell, PublicShell, TenantShell } from "./shells";
import { PRESENTER_ENABLED } from "./features";

/**
 * Route map (blueprint §4.3). Routes that are not built yet are registered as dev-only stubs;
 * in production builds they simply do not exist (Not Found), so no dead links ship.
 */
export function AppRoutes({ showUnbuilt = SHOW_UNBUILT }: { showUnbuilt?: boolean }) {
  return (
    <Routes>
      <Route index element={<EntryGate />} />
      <Route path="tenant/discover" element={<Onboarding />} />
      <Route element={<PublicShell />}>
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="credits" element={<Credits />} />
        {showUnbuilt && PUBLIC_STUBS.map((s) => <Route key={s.path} path={s.path} element={<DevStub stub={s} />} />)}
        <Route path="*" element={<NotFound />} />
      </Route>

      {PRESENTER_ENABLED && (
        <Route path="presenter" element={<PersonaShell showUnbuilt={showUnbuilt} />}>
          <Route index element={<PresenterPanelRoute />} />
        </Route>
      )}

      <Route path="trust" element={<PersonaShell showUnbuilt={showUnbuilt} />}>
        <Route index element={<TrustCenterPage />} />
      </Route>

      <Route path="tenant" element={<TenantShell showUnbuilt={showUnbuilt} />}>
        <Route index element={<TenantHome />} />
        <Route path="search" element={<TenantResults />} />
        <Route path="property/:propertyId" element={<PropertyDetails />} />
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="rental" element={<RentalPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {showUnbuilt && TENANT_STUBS.map((s) => <Route key={s.path} path={s.path} element={<DevStub stub={s} />} />)}
        </Route>
        <Route path="*" element={<NotFound persona="tenant" />} />
      </Route>

      <Route path="owner" element={<OwnerShell showUnbuilt={showUnbuilt} />}>
        <Route index element={<OwnerEntry />} />
        <Route path="dashboard" element={<OwnerDashboard />} />
        <Route path="properties" element={<MyProperties />} />
        <Route path="properties/new" element={<AddProperty />} />
        <Route path="properties/:propertyId" element={<PropertyManage />} />
        <Route path="properties/:propertyId/edit" element={<EditProperty />} />
        <Route path="requests" element={<EnquiriesPage />} />
        <Route path="rent" element={<RentTracking />} />
        <Route path="maintenance" element={<MaintenanceManagement />} />
        <Route path="verification" element={<VerificationCenter />} />
        <Route path="settings" element={<OwnerSettings />} />
        {showUnbuilt && OWNER_STUBS.map((s) => <Route key={s.path} path={s.path} element={<DevStub stub={s} />} />)}
        <Route path="*" element={<NotFound persona="owner" />} />
      </Route>
    </Routes>
  );
}
