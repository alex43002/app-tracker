import { AppLayout } from "../layouts/AppLayout";
import { DiscoveryFilters } from "../components/discovery/DiscoveryFilters";
import { DiscoveryResults } from "../components/discovery/DiscoveryResults";
import { ImportBoardPanel } from "../components/discovery/ImportBoardPanel";
import { PreferencesPanel } from "../components/discovery/PreferencesPanel";
import { ResumeFitPanel } from "../components/discovery/ResumeFitPanel";
import { SavedSearchesPanel } from "../components/discovery/SavedSearchesPanel";
import { useDiscovery } from "./discovery/useDiscovery";

export function Discovery() {
  const d = useDiscovery();

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Discover</h1>
          <p className="text-sm text-gray-500">
            Browse aggregated public postings from supported ATS systems.
            Filter, spot low-quality or stale listings, and rank by how well
            they match your résumé.
          </p>
        </div>

        <ImportBoardPanel
          sources={d.sources}
          ingestSource={d.ingestSource}
          setIngestSource={d.setIngestSource}
          boardToken={d.boardToken}
          setBoardToken={d.setBoardToken}
          companyName={d.companyName}
          setCompanyName={d.setCompanyName}
          careersUrl={d.careersUrl}
          setCareersUrl={d.setCareersUrl}
          directory={d.directory}
          importing={d.importing}
          resolving={d.resolving}
          onResolveUrl={d.handleResolveUrl}
          onPickCompany={d.handlePickCompany}
          onImport={d.handleImport}
        />

        <DiscoveryFilters
          filters={d.filters}
          setFilter={d.setFilter}
          locationFacets={d.locationFacets}
          noLocationCount={d.noLocationCount}
        />

        <PreferencesPanel
          filters={d.filters}
          setFilter={d.setFilter}
          prefs={d.prefs}
          showPrefs={d.showPrefs}
          setShowPrefs={d.setShowPrefs}
          newPreferred={d.newPreferred}
          setNewPreferred={d.setNewPreferred}
          newHidden={d.newHidden}
          setNewHidden={d.setNewHidden}
          savePrefs={d.savePrefs}
        />

        <SavedSearchesPanel
          alertName={d.alertName}
          setAlertName={d.setAlertName}
          alerts={d.alerts}
          onSave={d.handleSaveAlert}
          onCheck={d.handleCheckAlert}
          onToggleNotify={d.handleToggleNotify}
          onDelete={d.handleDeleteAlert}
        />

        {d.myJobs.length > 0 && (
          <ResumeFitPanel
            myJobs={d.myJobs}
            fitJobId={d.fitJobId}
            setFitJobId={d.setFitJobId}
            fitResumes={d.fitResumes}
            fitResumeId={d.fitResumeId}
            setFitResumeId={d.setFitResumeId}
            jobsCount={d.jobs.length}
            ranking={d.ranking}
            sortByFit={d.sortByFit}
            setSortByFit={d.setSortByFit}
            onRank={d.handleRankByFit}
          />
        )}

        <DiscoveryResults
          loading={d.loading}
          totalItems={d.totalItems}
          totalPages={d.totalPages}
          page={d.filters.page ?? 1}
          jobs={d.jobs}
          displayedJobs={d.displayedJobs}
          sortByFit={d.sortByFit}
          fitById={d.fitById}
          onHideCompany={d.prefs ? d.handleHideCompany : undefined}
          onPageChange={d.handlePageChange}
        />
      </div>
    </AppLayout>
  );
}
