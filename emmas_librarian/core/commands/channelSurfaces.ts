import { IpcChannel } from '../../src/types';

/**
 * Where a channel makes sense (#29):
 * - `cli`: any shell can offer it; the CLI exposes it as a subcommand.
 * - `gui-only`: it needs the desktop app on screen (a dialog, a window, the PDF reader, the updater).
 */
export type ChannelSurface = 'cli' | 'gui-only';

const C: ChannelSurface = 'cli';
const G: ChannelSurface = 'gui-only';

/**
 * Every channel classified. The Record makes the compiler refuse a new IpcChannel that nobody
 * classified, so the decision is taken when the channel is added.
 */
export const CHANNEL_SURFACES: Record<IpcChannel, ChannelSurface> = {
  // Native dialogs: there is no file dialog outside the desktop app; a CLI names files as arguments.
  [IpcChannel.DIALOG_OPEN_FILE]: G,
  [IpcChannel.DIALOG_OPEN_MULTIPLE_FILES]: G,
  [IpcChannel.DIALOG_SAVE_FILE]: G,

  // Opens the system's viewer or the browser on the person's computer.
  [IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL]: G,

  // The desktop app updating itself.
  [IpcChannel.UPDATE_CHECK]: G,
  [IpcChannel.UPDATE_DOWNLOAD]: G,
  [IpcChannel.UPDATE_INSTALL]: G,
  [IpcChannel.UPDATE_GET_STATUS]: G,
  [IpcChannel.UPDATE_RESTORE_SNAPSHOT]: G,

  // The PDF reader: the bytes it renders and the marks made on the page (positions only the reader can produce).
  [IpcChannel.PDF_GET]: G,
  [IpcChannel.HIGHLIGHTS_CREATE]: G,
  [IpcChannel.HIGHLIGHTS_DELETE]: G,
  [IpcChannel.PENDING_HIGHLIGHTS_GET]: G,
  [IpcChannel.PENDING_HIGHLIGHTS_DELETE]: G,

  // Everything else is a read or a write of the library that works from any shell.
  [IpcChannel.PROJECTS_GET_ALL]: C,
  [IpcChannel.PROJECTS_CREATE]: C,
  [IpcChannel.PROJECTS_GET_ONE]: C,
  [IpcChannel.PROJECTS_UPDATE]: C,
  [IpcChannel.PROJECTS_DELETE]: C,
  [IpcChannel.PROJECTS_GET_SEARCH_HISTORY]: C,
  [IpcChannel.PROJECTS_GET_WRITING_PAD]: C,
  [IpcChannel.PROJECTS_UPDATE_WRITING_PAD]: C,
  [IpcChannel.PROJECTS_GET_NAV_COUNTS]: C,
  [IpcChannel.PROJECTS_MARK_OPENED]: C,
  [IpcChannel.PROJECTS_GET_SCREENING_SUMMARIES]: C,
  [IpcChannel.PROJECTS_GET_ABOUT]: C,
  [IpcChannel.PROJECTS_UPDATE_ABOUT]: C,
  [IpcChannel.SEARCH_PREVIEW]: C,
  [IpcChannel.SEARCH_SAVE_PREVIEW]: C,
  [IpcChannel.SEARCH_MONITORS_LIST]: C,
  [IpcChannel.SEARCH_MONITOR_SET]: C,
  [IpcChannel.SEARCH_MONITOR_OVERVIEW]: C,
  [IpcChannel.SEARCH_MONITOR_CHECK]: C,
  [IpcChannel.SEARCH_MONITOR_REVIEW]: C,
  [IpcChannel.SEARCH_MONITOR_DISMISS]: C,
  [IpcChannel.SEARCH_PEEK_CITATIONS]: C,
  [IpcChannel.SEARCH_PREVIEW_CITATIONS]: C,
  [IpcChannel.SEARCH_DISCARD_PREVIEW]: C,
  [IpcChannel.SEARCH_TRANSLATE_QUERY]: C,
  [IpcChannel.SEARCH_REVERT]: C,
  [IpcChannel.ARTICLES_GET_BY_PROJECT]: C,
  [IpcChannel.ARTICLES_GET_ONE]: C,
  [IpcChannel.ARTICLES_UPDATE_STATUS]: C,
  [IpcChannel.ARTICLES_UPDATE_STATUS_MANY]: C,
  [IpcChannel.HIGHLIGHTS_GET]: C,
  [IpcChannel.ANNOTATIONS_GET]: C,
  [IpcChannel.ANNOTATIONS_CREATE]: C,
  [IpcChannel.ANNOTATIONS_UPDATE]: C,
  [IpcChannel.ANNOTATIONS_DELETE]: C,
  [IpcChannel.PDF_UPLOAD]: C,
  [IpcChannel.PDF_UNLINK]: C,
  [IpcChannel.PDF_FETCH_OPEN_ACCESS]: C,
  [IpcChannel.ARTICLES_CREATE_MANUAL]: C,
  [IpcChannel.EXPORT_CSV]: C,
  [IpcChannel.EXPORT_BIBLIOSHINY]: C,
  [IpcChannel.EXPORT_XLSX]: C,
  [IpcChannel.EXPORT_SEARCH_REPORT]: C,
  [IpcChannel.ARTICLES_CREATE_FROM_PDFS]: C,
  [IpcChannel.ARTICLES_UPDATE_METADATA]: C,
  [IpcChannel.SETTINGS_GET]: C,
  [IpcChannel.SETTINGS_SET]: C,
  [IpcChannel.DIARY_GET_ALL]: C,
  [IpcChannel.DIARY_GET_ONE]: C,
  [IpcChannel.DIARY_SAVE]: C,
  [IpcChannel.DIARY_DELETE]: C,
  [IpcChannel.APP_GET_VERSION]: C,
  [IpcChannel.AI_GENERATE_SUMMARY]: C,
  [IpcChannel.AI_MASSIVE_EXTRACTION]: C,
  [IpcChannel.AI_EXTRACT_METADATA]: C,
  [IpcChannel.ASK_CONVERSATIONS_LIST]: C,
  [IpcChannel.ASK_CONVERSATION_GET]: C,
  [IpcChannel.ASK_CONVERSATION_DELETE]: C,
  [IpcChannel.ASK_SEND]: C,
  [IpcChannel.ASK_COVERAGE]: C,
  [IpcChannel.ASK_INDEX_MISSING]: C,
  [IpcChannel.SCREENING_CRITERIA_GET]: C,
  [IpcChannel.SCREENING_CRITERIA_SAVE]: C,
  [IpcChannel.SCREENING_SUGGESTIONS_LIST]: C,
  [IpcChannel.SCREENING_SUGGEST]: C,
  [IpcChannel.SCREENING_ENGINE]: C,
  [IpcChannel.SCREENING_ORDER_GET]: C,
  [IpcChannel.SCREENING_ORDER_SET]: C,
  [IpcChannel.SCREENING_VECTORS_PLAN]: C,
  [IpcChannel.SCREENING_VECTORS_GENERATE]: C,
  [IpcChannel.SCREENING_RANK]: C,
  [IpcChannel.SCREENING_SIMULATE]: C,
  [IpcChannel.SCREENING_EVALUATE_CLASSIFIER]: C,
  [IpcChannel.ASK_INDEX_PLAN]: C,
  [IpcChannel.ASK_INDEX_PROGRESS]: C,
  [IpcChannel.AI_MODEL_CONFIG_GET_ALL]: C,
  [IpcChannel.AI_MODEL_CONFIG_UPDATE]: C,
  [IpcChannel.AI_MODEL_CONFIG_RESTORE]: C,
  [IpcChannel.PROJECT_DOCUMENTS_GET]: C,
  [IpcChannel.PROJECT_DOCUMENTS_CREATE]: C,
  [IpcChannel.PROJECT_DOCUMENTS_UPDATE]: C,
  [IpcChannel.PROJECT_DOCUMENTS_REORDER]: C,
  [IpcChannel.PROJECT_DOCUMENTS_DELETE]: C,
  [IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED]: C,
  [IpcChannel.MASSIVE_INVESTIGATIONS_GET]: C,
  [IpcChannel.MASSIVE_INVESTIGATIONS_SAVE]: C,
  [IpcChannel.CATEGORIES_GET_PROJECT]: C,
  [IpcChannel.CATEGORIES_CREATE_PROJECT]: C,
  [IpcChannel.CATEGORIES_UPDATE_PROJECT]: C,
  [IpcChannel.CATEGORIES_DELETE_PROJECT]: C,
  [IpcChannel.CATEGORIES_GET_ARTICLE]: C,
  [IpcChannel.CATEGORIES_SET_ARTICLE]: C,
  [IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE]: C,
  [IpcChannel.CATEGORIES_APPLY_SET]: C,
  [IpcChannel.CATEGORIES_READ_SET_FILE]: C,
  [IpcChannel.SYNC_EXPORT_PROJECT]: C,
  [IpcChannel.SYNC_IMPORT_PROJECT]: C,
  [IpcChannel.TRASH_GET_ITEMS]: C,
  [IpcChannel.TRASH_RESTORE_ITEM]: C,
  [IpcChannel.TRASH_PERMANENT_DELETE]: C,
  [IpcChannel.TRASH_EMPTY]: C,
  [IpcChannel.DIARY_GET_HISTORY]: C,
  [IpcChannel.DIARY_RESTORE_VERSION]: C,
  [IpcChannel.BACKUP_EXPORT]: C,
  [IpcChannel.BACKUP_RESTORE_OVERRIDE]: C,
  [IpcChannel.BACKUP_RESTORE_MERGE]: C,
  [IpcChannel.BACKUP_LIST_AUTO]: C,
  [IpcChannel.BACKUP_RESTORE_AUTO]: C,
  [IpcChannel.QUESTION_SETS_LIST]: C,
  [IpcChannel.QUESTION_SETS_GET]: C,
  [IpcChannel.QUESTION_SETS_CREATE]: C,
  [IpcChannel.QUESTION_SETS_UPDATE]: C,
  [IpcChannel.QUESTION_SETS_DELETE]: C,
  [IpcChannel.QUESTION_SETS_DUPLICATE]: C,
  [IpcChannel.INVESTIGATION_RESULTS_SAVE]: C,
  [IpcChannel.INVESTIGATION_RESULTS_GET]: C,
  [IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE]: C,
  [IpcChannel.INVESTIGATION_RESULT_REVIEW]: C,
  [IpcChannel.INVESTIGATION_AUDIT_GET]: C,
  [IpcChannel.INVESTIGATION_AUDIT_SAVE]: C,
  [IpcChannel.INVESTIGATION_AUDITS_BY_PROJECT]: C,
  [IpcChannel.SCREENING_LABELS_LIST]: C,
  [IpcChannel.SCREENING_LABEL_CREATE]: C,
  [IpcChannel.SCREENING_LABEL_RENAME]: C,
  [IpcChannel.SCREENING_LABEL_MOVE]: C,
  [IpcChannel.SCREENING_LABEL_DELETE]: C,
  [IpcChannel.SCREENING_PRESET_APPLY]: C,
  [IpcChannel.SCREENING_DECISIONS_LIST]: C,
  [IpcChannel.SCREENING_DECIDE]: C,
  [IpcChannel.SCREENING_UNDECIDE]: C,
  [IpcChannel.PRISMA_RECORDS_GET]: C,
  [IpcChannel.PRISMA_SOURCE_SAVE]: C,
  [IpcChannel.PRISMA_ORIGINS_SET]: C,
  [IpcChannel.PRISMA_STUDY_LINK]: C,
  [IpcChannel.PRISMA_STUDY_UNLINK]: C,
  [IpcChannel.EXPORT_PRISMA]: C,
  [IpcChannel.PDF_LIBRARY_LIST]: C,
  [IpcChannel.PDF_LIBRARY_DELETE]: C,
  [IpcChannel.PDF_LIBRARY_LINK]: C,
  [IpcChannel.PDF_LIBRARY_UPLOAD]: C,
  [IpcChannel.ARTICLES_IMPORT_FROM_PROJECT]: C,
  [IpcChannel.SCIENTIFIC_VENUES_GET_ALL]: C,
  [IpcChannel.SCIENTIFIC_VENUE_CREATE]: C,
  [IpcChannel.SCIENTIFIC_VENUE_UPDATE]: C,
  [IpcChannel.SCIENTIFIC_VENUE_DELETE]: C,
  [IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS]: C,
};

/**
 * The surface of a channel.
 *
 * Usage:
 *   surfaceOf(IpcChannel.PROJECTS_GET_ALL); // 'cli'
 */
export function surfaceOf(channel: IpcChannel): ChannelSurface {
  return CHANNEL_SURFACES[channel];
}

/**
 * The channels a shell without a screen can offer.
 *
 * Usage:
 *   for (const channel of cliChannels()) program.command(channel);
 */
export function cliChannels(): IpcChannel[] {
  return Object.values(IpcChannel).filter((channel) => surfaceOf(channel) === 'cli');
}
