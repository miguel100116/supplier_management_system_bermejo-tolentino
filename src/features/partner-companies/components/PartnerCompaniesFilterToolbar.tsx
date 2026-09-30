import type { ChangeEvent, RefObject } from 'react';
import { ArrowUpDown, Building, CalendarRange, ChevronDown, MapPin, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { PartnerCompanyType, SupplierOrigin } from '../../../types/survey';
import type { TableSortOption } from '../../../components/TableFilterBar';

export type PartnerStatusTab = 'Active' | 'Expired' | 'Incomplete' | 'Archived';
export type PartnerCategoryTab = PartnerCompanyType | 'All';
export type PartnerDocumentFilter = 'all' | 'current' | 'expiring' | 'expired' | 'missing';

interface PartnerCompaniesFilterToolbarProps {
  statusTab: PartnerStatusTab;
  statusLabels: Record<PartnerStatusTab, string>;
  onStatusChange: (value: PartnerStatusTab) => void;
  categoryTab: PartnerCategoryTab;
  onCategoryChange: (value: PartnerCategoryTab) => void;
  originFilter: 'All' | SupplierOrigin;
  onOriginChange: (value: 'All' | SupplierOrigin) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isAdmin?: boolean;
  importFileInputRef: RefObject<HTMLInputElement>;
  onImportFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenActiveCompanies: () => void;
  onOpenRegister: () => void;
  isAdvancedFiltersOpen: boolean;
  onToggleAdvancedFilters: () => void;
  advancedFilterCount: number;
  sortOptions: TableSortOption<string>[];
  sortValue: string;
  onSortChange: (value: string) => void;
  registeredFrom: string;
  registeredTo: string;
  onRegisteredFromChange: (value: string) => void;
  onRegisteredToChange: (value: string) => void;
  documentFilter: PartnerDocumentFilter;
  onDocumentFilterChange: (value: PartnerDocumentFilter) => void;
  resultCount: number;
  onReset: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: PartnerCategoryTab; label: string }> = [
  { value: 'All', label: 'All categories' },
  { value: 'Courier', label: 'Couriers' },
  { value: 'Supplier', label: 'Suppliers' },
  { value: 'Subcontractor', label: 'Subcontractors' },
  { value: 'Uncategorized', label: 'Uncategorized' },
];

export function PartnerCompaniesFilterToolbar({
  statusTab,
  statusLabels,
  onStatusChange,
  categoryTab,
  onCategoryChange,
  originFilter,
  onOriginChange,
  searchQuery,
  onSearchChange,
  isAdmin,
  importFileInputRef,
  onImportFileSelected,
  onOpenActiveCompanies,
  onOpenRegister,
  isAdvancedFiltersOpen,
  onToggleAdvancedFilters,
  advancedFilterCount,
  sortOptions,
  sortValue,
  onSortChange,
  registeredFrom,
  registeredTo,
  onRegisteredFromChange,
  onRegisteredToChange,
  documentFilter,
  onDocumentFilterChange,
  resultCount,
  onReset,
}: PartnerCompaniesFilterToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 flex-1 sm:min-w-[150px] sm:flex-none">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
          <select
            value={statusTab}
            onChange={(event) => onStatusChange(event.target.value as PartnerStatusTab)}
            className="field !mt-0 w-full py-2 text-xs sm:min-w-[170px]"
            aria-label="Filter partners by status"
          >
            {(Object.keys(statusLabels) as PartnerStatusTab[]).map((value) => (
              <option key={value} value={value}>{statusLabels[value]}</option>
            ))}
          </select>
        </label>

        <label className="min-w-0 flex-1 sm:min-w-[165px] sm:flex-none">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</span>
          <select
            value={categoryTab}
            onChange={(event) => onCategoryChange(event.target.value as PartnerCategoryTab)}
            className="field !mt-0 w-full py-2 text-xs sm:min-w-[185px]"
            aria-label="Filter partners by category"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {categoryTab === 'Supplier' && (
          <label className="min-w-0 flex-1 sm:min-w-[130px] sm:flex-none">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <MapPin size={11} aria-hidden="true" /> Supplier origin
            </span>
            <select
              value={originFilter}
              onChange={(event) => onOriginChange(event.target.value as 'All' | SupplierOrigin)}
              className="field !mt-0 w-full py-2 text-xs sm:min-w-[140px]"
              aria-label="Filter suppliers by origin"
            >
              <option value="All">All origins</option>
              <option value="Local">Local</option>
              <option value="Foreign">Foreign</option>
            </select>
          </label>
        )}

        <label className="relative min-w-0 flex-[1.5] sm:min-w-[210px] sm:flex-none sm:w-64">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name or BP Code..."
            className="field !mt-0 px-3 py-2 text-xs"
            aria-label="Search partners by name or BP Code"
          />
        </label>

        <button
          type="button"
          onClick={onToggleAdvancedFilters}
          className={`secondary-button min-h-10 justify-center gap-1.5 px-3 text-xs font-bold ${isAdvancedFiltersOpen ? 'ring-2 ring-[#0063a9]/20' : ''}`}
          aria-expanded={isAdvancedFiltersOpen}
          aria-controls="partner-company-advanced-filters"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filters
          {advancedFilterCount > 0 && (
            <span className="rounded-full bg-[#0063a9] px-1.5 py-0.5 text-[10px] leading-none text-white" aria-label={`${advancedFilterCount} active filters`}>
              {advancedFilterCount}
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${isAdvancedFiltersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {isAdmin && (
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onImportFileSelected}
            />
            <button type="button" onClick={onOpenActiveCompanies} className="secondary-button min-h-10 flex-1 gap-1.5 px-3 text-xs font-bold sm:flex-none" title="View active companies by type">
              <Building size={14} aria-hidden="true" />
              <span className="hidden lg:inline">Active Companies</span>
              <span className="lg:hidden">Active</span>
            </button>
            <button type="button" onClick={onOpenRegister} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0063a9] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition duration-150 hover:bg-[#00528c] sm:flex-none">
              <Plus size={15} aria-hidden="true" />
              <span>Register New Partner</span>
            </button>
          </div>
        )}
      </div>

      {isAdvancedFiltersOpen && (
        <div id="partner-company-advanced-filters" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 sm:min-w-[190px] sm:flex-none">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <ArrowUpDown size={12} aria-hidden="true" /> Sort
            </span>
            <select value={sortValue} onChange={(event) => onSortChange(event.target.value)} className="field !mt-0 w-full py-2 text-xs sm:min-w-[190px]" aria-label="Sort partner registry">
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <fieldset className="flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:flex-none">
            <legend className="mb-1 flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CalendarRange size={12} aria-hidden="true" /> Registration date
            </legend>
            <label className="min-w-[135px] flex-1 sm:flex-none">
              <span className="sr-only">Registration date from</span>
              <input type="date" value={registeredFrom} max={registeredTo || undefined} onChange={(event) => onRegisteredFromChange(event.target.value)} className="field !mt-0 w-full py-2 text-xs" aria-label="Registration date from" />
            </label>
            <span className="self-center pb-2 text-xs text-slate-400">to</span>
            <label className="min-w-[135px] flex-1 sm:flex-none">
              <span className="sr-only">Registration date to</span>
              <input type="date" value={registeredTo} min={registeredFrom || undefined} onChange={(event) => onRegisteredToChange(event.target.value)} className="field !mt-0 w-full py-2 text-xs" aria-label="Registration date to" />
            </label>
          </fieldset>

          <label className="min-w-0 flex-1 sm:min-w-[190px] sm:flex-none">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Document expiration</span>
            <select value={documentFilter} onChange={(event) => onDocumentFilterChange(event.target.value as PartnerDocumentFilter)} className="field !mt-0 w-full py-2 text-xs sm:min-w-[190px]" aria-label="Filter by document expiration">
              <option value="all">All document states</option>
              <option value="current">Current</option>
              <option value="expiring">Expiring soon</option>
              <option value="expired">Expired / for update</option>
              <option value="missing">Missing required docs</option>
            </select>
          </label>

          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{resultCount} result{resultCount === 1 ? '' : 's'}</span>
            <button type="button" onClick={onReset} className="secondary-button gap-1.5 px-2.5 py-2 text-xs" title="Reset all partner filters">
              <RotateCcw size={13} aria-hidden="true" /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
